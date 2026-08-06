#![no_std]

use soroban_sdk::{contract, contractimpl, Address, Env, String, Vec};

mod agent;
mod errors;
mod events;
mod storage;
mod types;

#[cfg(test)]
mod tests;

pub use agent::{
    complete_transaction, get_agent_average_rating, get_agent_count, get_agent_info, get_rating,
    rate_agent, register_agent, register_transaction, verify_agent,
};
pub use errors::AgentError;
pub use storage::DataKey;
pub use types::{AgentInfo, AgentTransaction, ContractState, PauseState, Rating};

#[contract]
pub struct AgentRegistryContract;

#[contractimpl]
impl AgentRegistryContract {
    /// Initialize the contract with an admin address.
    pub fn initialize(env: Env, admin: Address) -> Result<(), AgentError> {
        if env.storage().persistent().has(&DataKey::Initialized) {
            return Err(AgentError::AlreadyInitialized);
        }

        admin.require_auth();

        env.storage().persistent().set(&DataKey::Initialized, &true);
        env.storage()
            .persistent()
            .extend_ttl(&DataKey::Initialized, 500000, 500000);

        let state = ContractState {
            admin: admin.clone(),
            initialized: true,
        };

        env.storage().instance().set(&DataKey::State, &state);
        env.storage().instance().extend_ttl(500000, 500000);

        events::contract_initialized(&env, admin);

        Ok(())
    }

    pub fn get_state(env: Env) -> Option<ContractState> {
        env.storage().instance().get(&DataKey::State)
    }

    pub fn register_agent(
        env: Env,
        agent: Address,
        external_profile_hash: String,
    ) -> Result<(), AgentError> {
        agent::register_agent(&env, agent, external_profile_hash)
    }

    pub fn verify_agent(env: Env, admin: Address, agent: Address) -> Result<(), AgentError> {
        agent::verify_agent(&env, admin, agent)
    }

    pub fn rate_agent(
        env: Env,
        rater: Address,
        agent: Address,
        score: u32,
        transaction_id: String,
    ) -> Result<(), AgentError> {
        agent::rate_agent(&env, rater, agent, score, transaction_id)
    }

    pub fn get_agent_info(env: Env, agent: Address) -> Option<AgentInfo> {
        agent::get_agent_info(&env, agent)
    }

    pub fn get_agent_count(env: Env) -> u32 {
        agent::get_agent_count(&env)
    }

    pub fn get_agent_average_rating(env: Env, agent: Address) -> Option<u32> {
        agent::get_agent_average_rating(&env, agent)
    }

    pub fn get_rating(env: Env, agent: Address, rater: Address) -> Option<Rating> {
        agent::get_rating(&env, agent, rater)
    }

    pub fn register_transaction(
        env: Env,
        transaction_id: String,
        agent: Address,
        parties: Vec<Address>,
    ) -> Result<(), AgentError> {
        agent::register_transaction(&env, transaction_id, agent, parties)
    }

    pub fn complete_transaction(
        env: Env,
        transaction_id: String,
        agent: Address,
    ) -> Result<(), AgentError> {
        agent::complete_transaction(&env, transaction_id, agent)
    }

    pub fn pause(env: Env, admin: Address, reason: String) -> Result<(), AgentError> {
        let state = Self::get_state(env.clone()).ok_or(AgentError::NotInitialized)?;

        admin.require_auth();

        if admin != state.admin {
            return Err(AgentError::Unauthorized);
        }

        if Self::is_paused(env.clone()) {
            return Err(AgentError::AlreadyPaused);
        }

        let pause_state = PauseState {
            is_paused: true,
            paused_at: env.ledger().timestamp(),
            paused_by: admin.clone(),
            pause_reason: reason.clone(),
        };

        env.storage()
            .instance()
            .set(&DataKey::PauseState, &pause_state);
        env.storage().instance().extend_ttl(500000, 500000);

        events::paused(&env, reason, admin);
        Ok(())
    }

    pub fn unpause(env: Env, admin: Address) -> Result<(), AgentError> {
        let state = Self::get_state(env.clone()).ok_or(AgentError::NotInitialized)?;

        admin.require_auth();

        if admin != state.admin {
            return Err(AgentError::Unauthorized);
        }

        if !Self::is_paused(env.clone()) {
            return Err(AgentError::NotPaused);
        }

        env.storage().instance().remove(&DataKey::PauseState);

        events::unpaused(&env, admin);
        Ok(())
    }

    pub fn is_paused(env: Env) -> bool {
        env.storage()
            .instance()
            .get::<DataKey, PauseState>(&DataKey::PauseState)
            .map(|ps| ps.is_paused)
            .unwrap_or(false)
    }

    pub fn propose_admin(env: Env, admin: Address, new_admin: Address) -> Result<(), AgentError> {
        let state = Self::get_state(env.clone()).ok_or(AgentError::NotInitialized)?;

        admin.require_auth();

        if admin != state.admin {
            return Err(AgentError::Unauthorized);
        }

        env.storage()
            .instance()
            .set(&DataKey::PendingAdmin, &new_admin);
        env.storage().instance().extend_ttl(500000, 500000);

        events::admin_proposed(&env, admin, new_admin);
        Ok(())
    }

    pub fn accept_admin(env: Env, new_admin: Address) -> Result<(), AgentError> {
        let mut state = Self::get_state(env.clone()).ok_or(AgentError::NotInitialized)?;

        new_admin.require_auth();

        let pending_admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::PendingAdmin)
            .ok_or(AgentError::NoPendingAdmin)?;

        if new_admin != pending_admin {
            return Err(AgentError::NotPendingAdmin);
        }

        let old_admin = state.admin.clone();
        state.admin = new_admin.clone();

        env.storage().instance().set(&DataKey::State, &state);
        env.storage().instance().extend_ttl(500000, 500000);
        env.storage().instance().remove(&DataKey::PendingAdmin);

        events::admin_transferred(&env, old_admin, new_admin);
        Ok(())
    }

    pub fn get_pending_admin(env: Env) -> Option<Address> {
        env.storage().instance().get(&DataKey::PendingAdmin)
    }
}
