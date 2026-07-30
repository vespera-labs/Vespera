use crate::{
    errors::RentalError,
    events, multi_token, rate_limit,
    storage::DataKey,
    types::{
        ActionType, AdminProposal, Config, ContractState, MultiSigConfig, PauseState,
        RateLimitConfig,
    },
};
use soroban_sdk::{Address, Bytes, Env, String, Vec};

const PROPOSAL_EXPIRY_SECONDS: u64 = 7 * 24 * 60 * 60; // 7 days

// ─── ID Generation ────────────────────────────────────────────────────────────

const HEX: [u8; 16] = *b"0123456789abcdef";

/// Generate a unique proposal ID like "prop_0000001a" from a counter value.
///
/// Mirrors `timelock::make_action_id` so every proposal gets a distinct key.
/// Without this each proposal reused the constant "prop_" key and overwrote
/// the previous one.
fn make_proposal_id(env: &Env, count: u32) -> String {
    let b = count.to_be_bytes(); // 4 bytes big-endian
    let encoded: [u8; 13] = [
        b'p',
        b'r',
        b'o',
        b'p',
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

/// Initialize multi-sig configuration
pub fn initialize_multisig(
    env: &Env,
    admins: Vec<Address>,
    required_signatures: u32,
) -> Result<(), RentalError> {
    // Check if already initialized
    if env.storage().instance().has(&DataKey::MultiSigConfig) {
        return Err(RentalError::AlreadyInitialized);
    }

    let total_admins = admins.len();
    if total_admins == 0 {
        return Err(RentalError::InvalidConfig);
    }

    if required_signatures == 0 || required_signatures > total_admins {
        return Err(RentalError::InvalidConfig);
    }

    // Verify all admins are unique
    for i in 0..admins.len() {
        for j in (i + 1)..admins.len() {
            if admins.get(i).unwrap() == admins.get(j).unwrap() {
                return Err(RentalError::InvalidConfig);
            }
        }
    }

    let config = MultiSigConfig {
        admins,
        required_signatures,
        total_admins,
    };

    env.storage()
        .instance()
        .set(&DataKey::MultiSigConfig, &config);
    env.storage().instance().extend_ttl(500000, 500000);

    // Initialize proposal count
    env.storage().instance().set(&DataKey::ProposalCount, &0u32);

    events::multisig_initialized(env, total_admins, required_signatures);

    Ok(())
}

/// Get multi-sig configuration
pub fn get_multisig_config(env: &Env) -> Result<MultiSigConfig, RentalError> {
    env.storage()
        .instance()
        .get(&DataKey::MultiSigConfig)
        .ok_or(RentalError::MultiSigNotInitialized)
}

/// Check if an address is an admin
pub fn is_admin(env: &Env, address: &Address) -> Result<bool, RentalError> {
    let config = get_multisig_config(env)?;

    for admin in config.admins.iter() {
        if &admin == address {
            return Ok(true);
        }
    }

    Ok(false)
}

/// Require that the caller is an admin
pub fn require_admin(env: &Env, caller: &Address) -> Result<(), RentalError> {
    if !is_admin(env, caller)? {
        return Err(RentalError::Unauthorized);
    }
    Ok(())
}

/// Propose an admin action
pub fn propose_action(
    env: &Env,
    proposer: Address,
    action_type: ActionType,
    target: Option<Address>,
    data: Bytes,
) -> Result<String, RentalError> {
    proposer.require_auth();
    require_admin(env, &proposer)?;

    // Generate proposal ID
    let mut proposal_count: u32 = env
        .storage()
        .instance()
        .get(&DataKey::ProposalCount)
        .unwrap_or(0);

    proposal_count += 1;
    // Derive a unique proposal ID from the incrementing counter so each
    // proposal is stored under its own DataKey::AdminProposal key. Previously
    // this was a constant "prop_", so every new proposal silently overwrote
    // the prior one and approvals were attributed to the wrong proposal.
    let proposal_id = make_proposal_id(env, proposal_count);

    // Create proposal with single approval from proposer
    let mut approvals = Vec::new(env);
    approvals.push_back(proposer.clone());

    let proposal = AdminProposal {
        id: proposal_id.clone(),
        proposer: proposer.clone(),
        action_type: action_type.clone(),
        target,
        data,
        approvals,
        approval_count: 1,
        executed: false,
        created_at: env.ledger().timestamp(),
        expiry: env.ledger().timestamp() + PROPOSAL_EXPIRY_SECONDS,
    };

    // Store proposal
    env.storage()
        .persistent()
        .set(&DataKey::AdminProposal(proposal_id.clone()), &proposal);
    env.storage().persistent().extend_ttl(
        &DataKey::AdminProposal(proposal_id.clone()),
        500000,
        500000,
    );

    // Update proposal count
    env.storage()
        .instance()
        .set(&DataKey::ProposalCount, &proposal_count);

    // Add to active proposals list
    let mut active_proposals: Vec<String> = env
        .storage()
        .instance()
        .get(&DataKey::ActiveProposals)
        .unwrap_or(Vec::new(env));
    active_proposals.push_back(proposal_id.clone());
    env.storage()
        .instance()
        .set(&DataKey::ActiveProposals, &active_proposals);

    events::action_proposed(env, proposal_id.clone(), proposer, action_type);

    Ok(proposal_id)
}

/// Approve a proposal
pub fn approve_action(
    env: &Env,
    approver: Address,
    proposal_id: String,
) -> Result<(), RentalError> {
    approver.require_auth();
    require_admin(env, &approver)?;

    let mut proposal: AdminProposal = env
        .storage()
        .persistent()
        .get(&DataKey::AdminProposal(proposal_id.clone()))
        .ok_or(RentalError::ProposalNotFound)?;

    // Check if already executed
    if proposal.executed {
        return Err(RentalError::ProposalAlreadyExecuted);
    }

    // Check if expired
    if env.ledger().timestamp() > proposal.expiry {
        return Err(RentalError::ProposalExpired);
    }

    // Check if already approved by this address
    for approval in proposal.approvals.iter() {
        if approval == approver {
            return Err(RentalError::AlreadyApproved);
        }
    }

    // Add approval
    proposal.approvals.push_back(approver.clone());
    proposal.approval_count += 1;

    // Update proposal
    env.storage()
        .persistent()
        .set(&DataKey::AdminProposal(proposal_id.clone()), &proposal);

    events::action_approved(env, proposal_id, approver, proposal.approval_count);

    Ok(())
}

/// Execute a proposal if it has enough approvals
pub fn execute_action(
    env: &Env,
    executor: Address,
    proposal_id: String,
) -> Result<(), RentalError> {
    executor.require_auth();
    require_admin(env, &executor)?;

    let mut proposal: AdminProposal = env
        .storage()
        .persistent()
        .get(&DataKey::AdminProposal(proposal_id.clone()))
        .ok_or(RentalError::ProposalNotFound)?;

    // Check if already executed
    if proposal.executed {
        return Err(RentalError::ProposalAlreadyExecuted);
    }

    // Check if expired
    if env.ledger().timestamp() > proposal.expiry {
        return Err(RentalError::ProposalExpired);
    }

    // Check if has enough approvals
    let config = get_multisig_config(env)?;
    if proposal.approval_count < config.required_signatures {
        return Err(RentalError::InsufficientApprovals);
    }

    // Execute the approved governance action. Every branch performs the
    // corresponding state change before the proposal is marked executed, so
    // a fully-approved proposal can never be a silent no-op (issue #66/#227).
    match proposal.action_type {
        ActionType::AddAdmin => {
            let new_admin = proposal.target.clone().ok_or(RentalError::InvalidInput)?;
            add_admin_internal(env, new_admin)?;
        }
        ActionType::RemoveAdmin => {
            let admin_to_remove = proposal.target.clone().ok_or(RentalError::InvalidInput)?;
            remove_admin_internal(env, admin_to_remove)?;
        }
        ActionType::UpdateRequiredSignatures => {
            let new_required = parse_required_signatures(&proposal.data)?;
            update_required_signatures_internal(env, new_required)?;
        }
        ActionType::Pause => {
            let reason = String::from_str(env, "Paused via multi-sig governance");
            pause_internal(env, executor.clone(), reason);
        }
        ActionType::Unpause => {
            unpause_internal(env, executor.clone());
        }
        ActionType::UpdateConfig => {
            let fee_collector = proposal.target.clone().ok_or(RentalError::InvalidInput)?;
            let new_config = parse_config_payload(&proposal.data, fee_collector)?;
            apply_config_internal(env, new_config)?;
        }
        ActionType::AddToken => {
            let token_address = proposal.target.clone().ok_or(RentalError::InvalidInput)?;
            let (symbol, decimals, min_amount, max_amount) =
                parse_add_token_payload(&proposal.data)?;
            multi_token::add_supported_token(
                env.clone(),
                token_address,
                symbol,
                decimals,
                min_amount,
                max_amount,
            )?;
        }
        ActionType::RemoveToken => {
            let token_address = proposal.target.clone().ok_or(RentalError::InvalidInput)?;
            multi_token::remove_supported_token(env.clone(), token_address)?;
        }
        ActionType::SetRateLimit => {
            let config = parse_rate_limit_payload(&proposal.data)?;
            rate_limit::set_rate_limit_config(env, config.clone())?;
            events::rate_limit_config_updated(
                env,
                config.max_calls_per_block,
                config.max_calls_per_user_per_day,
                config.cooldown_blocks,
            );
        }
        ActionType::UpdateRate | ActionType::EmergencyAction => {
            // These action types carry no corresponding contract state
            // anywhere in the codebase today, so there is nothing to apply.
            // Wiring them up would mean inventing new behavior, which is out
            // of scope here (see issue #66/#227: "Adding new action types").
        }
    }

    // Mark as executed
    proposal.executed = true;
    env.storage()
        .persistent()
        .set(&DataKey::AdminProposal(proposal_id.clone()), &proposal);

    // Remove from active proposals
    let active_proposals: Vec<String> = env
        .storage()
        .instance()
        .get(&DataKey::ActiveProposals)
        .unwrap_or(Vec::new(env));

    let mut new_active = Vec::new(env);
    for id in active_proposals.iter() {
        if id != proposal_id {
            new_active.push_back(id);
        }
    }
    env.storage()
        .instance()
        .set(&DataKey::ActiveProposals, &new_active);

    events::action_executed(env, proposal_id, proposal.action_type);

    Ok(())
}

fn parse_required_signatures(data: &Bytes) -> Result<u32, RentalError> {
    if data.len() != 4 {
        return Err(RentalError::InvalidInput);
    }
    let mut buf = [0u8; 4];
    for (i, b) in buf.iter_mut().enumerate() {
        *b = data.get(i as u32).ok_or(RentalError::InvalidInput)?;
    }
    Ok(u32::from_be_bytes(buf))
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

fn parse_i128_at(data: &Bytes, offset: u32) -> Result<i128, RentalError> {
    let mut buf = [0u8; 16];
    for (i, b) in buf.iter_mut().enumerate() {
        *b = data
            .get(offset + i as u32)
            .ok_or(RentalError::InvalidInput)?;
    }
    Ok(i128::from_be_bytes(buf))
}

/// Decode an `ActionType::UpdateConfig` payload: `[fee_bps: u32 BE][paused: u8]`.
/// `fee_collector` comes from the proposal's `target` field, not the payload.
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

/// Decode an `ActionType::AddToken` payload:
/// `[symbol_len: u8][symbol bytes][decimals: u32 BE][min_amount: i128 BE][max_amount: i128 BE]`.
/// The token address comes from the proposal's `target` field.
fn parse_add_token_payload(data: &Bytes) -> Result<(String, u32, i128, i128), RentalError> {
    let symbol_len = data.first().ok_or(RentalError::InvalidInput)? as u32;
    if symbol_len == 0 || symbol_len > 32 {
        return Err(RentalError::InvalidInput);
    }
    let expected_len = 1 + symbol_len + 4 + 16 + 16;
    if data.len() != expected_len {
        return Err(RentalError::InvalidInput);
    }

    let symbol = data.slice(1..1 + symbol_len).to_string();
    let decimals = parse_u32_at(data, 1 + symbol_len)?;
    let min_amount = parse_i128_at(data, 1 + symbol_len + 4)?;
    let max_amount = parse_i128_at(data, 1 + symbol_len + 4 + 16)?;

    Ok((symbol, decimals, min_amount, max_amount))
}

/// Decode an `ActionType::SetRateLimit` payload:
/// `[max_calls_per_block: u32 BE][max_calls_per_user_per_day: u32 BE][cooldown_blocks: u32 BE]`.
fn parse_rate_limit_payload(data: &Bytes) -> Result<RateLimitConfig, RentalError> {
    if data.len() != 12 {
        return Err(RentalError::InvalidInput);
    }
    Ok(RateLimitConfig {
        max_calls_per_block: parse_u32_at(data, 0)?,
        max_calls_per_user_per_day: parse_u32_at(data, 4)?,
        cooldown_blocks: parse_u32_at(data, 8)?,
    })
}

/// Idempotently mark the contract paused, mirroring `Contract::pause` but
/// without re-requiring `state.admin`'s signature: multi-sig quorum (already
/// checked by the caller) is the authority for this path.
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

/// Apply a governance-approved config change, mirroring `Contract::update_config`
/// but authorized by multi-sig quorum instead of `state.admin`.
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
        let reason = String::from_str(env, "Paused via multi-sig governance");
        pause_internal(env, state.admin.clone(), reason);
    } else if !new_config.paused && was_paused {
        unpause_internal(env, state.admin.clone());
    }

    events::config_updated(env, state.admin, old_config, new_config);
    Ok(())
}

/// Reject/cancel a proposal (only proposer can do this before execution)
pub fn reject_action(env: &Env, caller: Address, proposal_id: String) -> Result<(), RentalError> {
    caller.require_auth();
    require_admin(env, &caller)?;

    let proposal: AdminProposal = env
        .storage()
        .persistent()
        .get(&DataKey::AdminProposal(proposal_id.clone()))
        .ok_or(RentalError::ProposalNotFound)?;

    // Only proposer can reject before execution
    if proposal.proposer != caller {
        return Err(RentalError::Unauthorized);
    }

    if proposal.executed {
        return Err(RentalError::ProposalAlreadyExecuted);
    }

    // Remove proposal
    env.storage()
        .persistent()
        .remove(&DataKey::AdminProposal(proposal_id.clone()));

    // Remove from active proposals
    let active_proposals: Vec<String> = env
        .storage()
        .instance()
        .get(&DataKey::ActiveProposals)
        .unwrap_or(Vec::new(env));

    let mut new_active = Vec::new(env);
    for id in active_proposals.iter() {
        if id != proposal_id {
            new_active.push_back(id);
        }
    }
    env.storage()
        .instance()
        .set(&DataKey::ActiveProposals, &new_active);

    events::action_rejected(env, proposal_id);

    Ok(())
}

/// Add a new admin through multi-sig proposal execution
pub fn add_admin_internal(env: &Env, new_admin: Address) -> Result<(), RentalError> {
    let mut config = get_multisig_config(env)?;

    // Check if already admin
    for admin in config.admins.iter() {
        if admin == new_admin {
            return Err(RentalError::InvalidInput);
        }
    }

    // Add new admin
    config.admins.push_back(new_admin.clone());
    config.total_admins += 1;

    // Update storage
    env.storage()
        .instance()
        .set(&DataKey::MultiSigConfig, &config);
    env.storage().instance().extend_ttl(500000, 500000);

    events::admin_added(env, new_admin, config.total_admins);

    Ok(())
}

/// Remove an admin through multi-sig proposal execution
pub fn remove_admin_internal(env: &Env, admin_to_remove: Address) -> Result<(), RentalError> {
    let mut config = get_multisig_config(env)?;

    // Cannot remove last admin
    if config.total_admins <= 1 {
        return Err(RentalError::InvalidConfig);
    }

    // Find and remove admin
    let mut found = false;
    let mut new_admins = Vec::new(env);

    for admin in config.admins.iter() {
        if admin == admin_to_remove {
            found = true;
        } else {
            new_admins.push_back(admin);
        }
    }

    if !found {
        return Err(RentalError::Unauthorized);
    }

    config.admins = new_admins;
    config.total_admins -= 1;

    // Adjust required signatures if needed
    if config.required_signatures > config.total_admins {
        config.required_signatures = config.total_admins;
    }

    // Update storage
    env.storage()
        .instance()
        .set(&DataKey::MultiSigConfig, &config);
    env.storage().instance().extend_ttl(500000, 500000);

    events::admin_removed(env, admin_to_remove, config.total_admins);

    Ok(())
}

/// Update required signatures through multi-sig proposal execution
pub fn update_required_signatures_internal(
    env: &Env,
    new_required: u32,
) -> Result<(), RentalError> {
    let mut config = get_multisig_config(env)?;

    if new_required == 0 || new_required > config.total_admins {
        return Err(RentalError::InvalidConfig);
    }

    let old_required = config.required_signatures;
    config.required_signatures = new_required;

    // Update storage
    env.storage()
        .instance()
        .set(&DataKey::MultiSigConfig, &config);
    env.storage().instance().extend_ttl(500000, 500000);

    events::required_signatures_updated(env, old_required, new_required);

    Ok(())
}

/// Get a proposal by ID
pub fn get_proposal(env: &Env, proposal_id: String) -> Result<AdminProposal, RentalError> {
    env.storage()
        .persistent()
        .get(&DataKey::AdminProposal(proposal_id))
        .ok_or(RentalError::ProposalNotFound)
}

/// Get all active proposals
pub fn get_active_proposals(env: &Env) -> Result<Vec<String>, RentalError> {
    Ok(env
        .storage()
        .instance()
        .get(&DataKey::ActiveProposals)
        .unwrap_or(Vec::new(env)))
}

/// Get proposal count
pub fn get_proposal_count(env: &Env) -> u32 {
    env.storage()
        .instance()
        .get(&DataKey::ProposalCount)
        .unwrap_or(0)
}
