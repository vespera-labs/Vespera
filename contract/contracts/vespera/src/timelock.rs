use crate::{
    errors::RentalError,
    events,
    storage::DataKey,
    types::{Config, ContractState, PauseState, TimelockAction, TimelockActionType},
};
use soroban_sdk::{Address, Bytes, Env, String, Vec};

// ─── ID Generation ────────────────────────────────────────────────────────────

const HEX: [u8; 16] = *b"0123456789abcdef";

/// Generate a unique action ID like "tl_0000001a" from a counter value.
fn make_action_id(env: &Env, count: u32) -> String {
    let b = count.to_be_bytes(); // 4 bytes big-endian
    let encoded: [u8; 11] = [
        b't',
        b'l',
        b'_',
        HEX[((b[0] >> 4) & 0xf) as usize],
        HEX[(b[0] & 0xf) as usize],
        HEX[((b[1] >> 4) & 0xf) as usize],
        HEX[(b[1] & 0xf) as usize],
        HEX[((b[2] >> 4) & 0xf) as usize],
        HEX[(b[2] & 0xf) as usize],
        HEX[((b[3] >> 4) & 0xf) as usize],
        HEX[(b[3] & 0xf) as usize],
    ];
    String::from_bytes(env, &encoded)
}

// ─── Minimum Delays (in seconds) ─────────────────────────────────────────────

/// 7 days
const MIN_DELAY_UPDATE_ADMIN: u64 = 7 * 24 * 60 * 60;
/// 3 days
const MIN_DELAY_UPDATE_CONFIG: u64 = 3 * 24 * 60 * 60;
/// 2 days
const MIN_DELAY_UPDATE_RATES: u64 = 2 * 24 * 60 * 60;
/// 1 day
const MIN_DELAY_PAUSE: u64 = 24 * 60 * 60;
/// 1 hour
const MIN_DELAY_UNPAUSE: u64 = 60 * 60;

/// Returns the minimum required delay (seconds) for a given action type.
pub fn get_min_delay(action_type: &TimelockActionType) -> u64 {
    match action_type {
        TimelockActionType::UpdateAdmin => MIN_DELAY_UPDATE_ADMIN,
        TimelockActionType::UpdateConfig => MIN_DELAY_UPDATE_CONFIG,
        TimelockActionType::UpdateRates => MIN_DELAY_UPDATE_RATES,
        TimelockActionType::PauseContract => MIN_DELAY_PAUSE,
        TimelockActionType::UnpauseContract => MIN_DELAY_UNPAUSE,
    }
}

// ─── Internal Helpers ─────────────────────────────────────────────────────────

fn require_admin(env: &Env, caller: &Address) -> Result<(), RentalError> {
    let state: ContractState = env
        .storage()
        .instance()
        .get(&DataKey::State)
        .ok_or(RentalError::InvalidState)?;
    if state.admin != *caller {
        return Err(RentalError::Unauthorized);
    }
    Ok(())
}

fn remove_from_active(env: &Env, action_id: &String) {
    let active: Vec<String> = env
        .storage()
        .instance()
        .get(&DataKey::ActiveTimelockActions)
        .unwrap_or(Vec::new(env));

    let mut new_active = Vec::new(env);
    for id in active.iter() {
        if &id != action_id {
            new_active.push_back(id);
        }
    }
    env.storage()
        .instance()
        .set(&DataKey::ActiveTimelockActions, &new_active);
}

// ─── Public Functions ─────────────────────────────────────────────────────────

/// Queue a new admin action with a mandatory delay.
///
/// Only the contract admin may call this. `delay` (seconds) must be at or
/// above the minimum enforced for the given `action_type`. Returns the
/// action ID that can be used to execute or cancel the action later.
pub fn queue_action(
    env: &Env,
    caller: Address,
    action_type: TimelockActionType,
    target: Address,
    data: Bytes,
    delay: u64,
) -> Result<String, RentalError> {
    caller.require_auth();
    require_admin(env, &caller)?;

    // Enforce minimum delay for the action type
    let min_delay = get_min_delay(&action_type);
    if delay < min_delay {
        return Err(RentalError::TimelockDelayTooShort);
    }

    let now = env.ledger().timestamp();
    let eta = now + delay;

    // Generate a unique action ID using an incrementing counter
    let mut action_count: u32 = env
        .storage()
        .instance()
        .get(&DataKey::TimelockActionCount)
        .unwrap_or(0);
    action_count += 1;

    let action_id = make_action_id(env, action_count);

    let action = TimelockAction {
        id: action_id.clone(),
        action_type,
        target,
        data,
        eta,
        executed: false,
        cancelled: false,
    };

    // Persist the action
    env.storage()
        .persistent()
        .set(&DataKey::TimelockAction(action_id.clone()), &action);
    env.storage().persistent().extend_ttl(
        &DataKey::TimelockAction(action_id.clone()),
        500000,
        500000,
    );

    // Update counter
    env.storage()
        .instance()
        .set(&DataKey::TimelockActionCount, &action_count);
    env.storage().instance().extend_ttl(500000, 500000);

    // Track in active list
    let mut active: Vec<String> = env
        .storage()
        .instance()
        .get(&DataKey::ActiveTimelockActions)
        .unwrap_or(Vec::new(env));
    active.push_back(action_id.clone());
    env.storage()
        .instance()
        .set(&DataKey::ActiveTimelockActions, &active);

    events::timelock_action_queued(env, action_id.clone(), eta);

    Ok(action_id)
}

/// Execute a queued action once its ETA has been reached.
///
/// Any caller may trigger execution once the ETA has passed. The action must
/// not have been previously executed or cancelled.
pub fn execute_action(env: &Env, caller: Address, action_id: String) -> Result<(), RentalError> {
    caller.require_auth();

    let mut action: TimelockAction = env
        .storage()
        .persistent()
        .get(&DataKey::TimelockAction(action_id.clone()))
        .ok_or(RentalError::TimelockNotFound)?;

    if action.executed {
        return Err(RentalError::TimelockAlreadyExecuted);
    }

    if action.cancelled {
        return Err(RentalError::TimelockAlreadyCancelled);
    }

    if env.ledger().timestamp() < action.eta {
        return Err(RentalError::TimelockEtaNotReached);
    }

    // Apply the queued change before marking the action executed, so a
    // matured action can never be a silent no-op (issue #66/#227).
    match action.action_type {
        TimelockActionType::UpdateAdmin => {
            update_admin_internal(env, action.target.clone())?;
        }
        TimelockActionType::UpdateConfig => {
            let new_config = parse_config_payload(&action.data, action.target.clone())?;
            apply_config_internal(env, new_config)?;
        }
        TimelockActionType::UpdateRates => {
            // No dedicated "rates" state exists in this contract separate
            // from Config.fee_bps (already covered by UpdateConfig), so
            // there is nothing to apply. Adding new state for this is out
            // of scope here (see issue #66/#227: "Adding new action types").
        }
        TimelockActionType::PauseContract => {
            let reason = String::from_str(env, "Paused via timelock governance");
            pause_internal(env, caller.clone(), reason);
        }
        TimelockActionType::UnpauseContract => {
            unpause_internal(env, caller.clone());
        }
    }

    action.executed = true;
    env.storage()
        .persistent()
        .set(&DataKey::TimelockAction(action_id.clone()), &action);

    remove_from_active(env, &action_id);

    events::timelock_action_executed(env, action_id);

    Ok(())
}

fn parse_u32_at(data: &Bytes, offset: u32) -> Result<u32, RentalError> {
    let mut buf = [0u8; 4];
    for (i, b) in buf.iter_mut().enumerate() {
        *b = data
            .get(offset + i as u32)
            .ok_or(RentalError::InvalidInput)?;
    }
    Ok(u32::from_be_bytes(buf))
}

/// Decode a `TimelockActionType::UpdateConfig` payload:
/// `[fee_bps: u32 BE][paused: u8]`. `fee_collector` comes from the queued
/// action's `target` field, not the payload.
fn parse_config_payload(data: &Bytes, fee_collector: Address) -> Result<Config, RentalError> {
    if data.len() != 5 {
        return Err(RentalError::InvalidInput);
    }
    let fee_bps = parse_u32_at(data, 0)?;
    let paused = match data.get_unchecked(4) {
        0 => false,
        1 => true,
        _ => return Err(RentalError::InvalidInput),
    };
    if fee_bps > 10_000 {
        return Err(RentalError::InvalidConfig);
    }
    Ok(Config {
        fee_bps,
        fee_collector,
        paused,
    })
}

/// Idempotently mark the contract paused, mirroring `Contract::pause` but
/// without requiring `state.admin`'s signature: a matured timelock action is
/// itself the authority for this path.
fn pause_internal(env: &Env, paused_by: Address, reason: String) {
    let pause_state = PauseState {
        is_paused: true,
        paused_at: env.ledger().timestamp(),
        paused_by: paused_by.clone(),
        pause_reason: reason.clone(),
    };
    env.storage()
        .instance()
        .set(&DataKey::PauseState, &pause_state);
    env.storage().instance().extend_ttl(500000, 500000);

    if let Some(mut state) = env
        .storage()
        .instance()
        .get::<DataKey, ContractState>(&DataKey::State)
    {
        if !state.config.paused {
            state.config.paused = true;
            env.storage().instance().set(&DataKey::State, &state);
        }
    }

    events::paused(env, reason, paused_by);
}

/// Idempotently clear the paused state; see [`pause_internal`].
fn unpause_internal(env: &Env, unpaused_by: Address) {
    env.storage().instance().remove(&DataKey::PauseState);

    if let Some(mut state) = env
        .storage()
        .instance()
        .get::<DataKey, ContractState>(&DataKey::State)
    {
        if state.config.paused {
            state.config.paused = false;
            env.storage().instance().set(&DataKey::State, &state);
        }
    }

    events::unpaused(env, unpaused_by);
}

/// Apply a matured `UpdateConfig` action, mirroring `Contract::update_config`
/// but authorized by the timelock (already enforced by ETA + queue-time
/// admin check) instead of a fresh `state.admin` signature.
fn apply_config_internal(env: &Env, new_config: Config) -> Result<(), RentalError> {
    let mut state: ContractState = env
        .storage()
        .instance()
        .get(&DataKey::State)
        .ok_or(RentalError::InvalidState)?;

    let was_paused = state.config.paused;
    let old_config = state.config.clone();
    state.config = new_config.clone();

    env.storage().instance().set(&DataKey::State, &state);
    env.storage().instance().extend_ttl(500000, 500000);

    if new_config.paused && !was_paused {
        let reason = String::from_str(env, "Paused via timelock governance");
        pause_internal(env, state.admin.clone(), reason);
    } else if !new_config.paused && was_paused {
        unpause_internal(env, state.admin.clone());
    }

    events::config_updated(env, state.admin, old_config, new_config);
    Ok(())
}

/// Apply a matured `UpdateAdmin` action.
fn update_admin_internal(env: &Env, new_admin: Address) -> Result<(), RentalError> {
    let mut state: ContractState = env
        .storage()
        .instance()
        .get(&DataKey::State)
        .ok_or(RentalError::InvalidState)?;

    state.admin = new_admin;
    env.storage().instance().set(&DataKey::State, &state);
    env.storage().instance().extend_ttl(500000, 500000);

    Ok(())
}

/// Cancel a queued action before it has been executed.
///
/// Only the contract admin may cancel. The action must not have been
/// previously executed or cancelled.
pub fn cancel_action(env: &Env, caller: Address, action_id: String) -> Result<(), RentalError> {
    caller.require_auth();
    require_admin(env, &caller)?;

    let mut action: TimelockAction = env
        .storage()
        .persistent()
        .get(&DataKey::TimelockAction(action_id.clone()))
        .ok_or(RentalError::TimelockNotFound)?;

    if action.executed {
        return Err(RentalError::TimelockAlreadyExecuted);
    }

    if action.cancelled {
        return Err(RentalError::TimelockAlreadyCancelled);
    }

    action.cancelled = true;
    env.storage()
        .persistent()
        .set(&DataKey::TimelockAction(action_id.clone()), &action);

    remove_from_active(env, &action_id);

    events::timelock_action_cancelled(env, action_id);

    Ok(())
}

/// Retrieve a timelock action by ID.
pub fn get_action(env: &Env, action_id: String) -> Result<TimelockAction, RentalError> {
    env.storage()
        .persistent()
        .get(&DataKey::TimelockAction(action_id))
        .ok_or(RentalError::TimelockNotFound)
}

/// Return all currently active (pending) timelock action IDs.
pub fn get_active_actions(env: &Env) -> Vec<String> {
    env.storage()
        .instance()
        .get(&DataKey::ActiveTimelockActions)
        .unwrap_or(Vec::new(env))
}

/// Return the total number of timelock actions ever queued.
pub fn get_action_count(env: &Env) -> u32 {
    env.storage()
        .instance()
        .get(&DataKey::TimelockActionCount)
        .unwrap_or(0)
}
