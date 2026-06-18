use soroban_sdk::{Address, Env, String, Vec};

use crate::errors::AgentError;
use crate::events;
use crate::storage::DataKey;
use crate::types::{AgentInfo, AgentTransaction, ContractState, Rating};

pub fn register_agent(
    env: &Env,
    agent: Address,
    external_profile_hash: String,
) -> Result<(), AgentError> {
    if !env.storage().persistent().has(&DataKey::Initialized) {
        return Err(AgentError::NotInitialized);
    }

    agent.require_auth();

    if external_profile_hash.is_empty() {
        return Err(AgentError::InvalidProfileHash);
    }

    let key = DataKey::Agent(agent.clone());
    if env.storage().persistent().has(&key) {
        return Err(AgentError::AgentAlreadyRegistered);
    }

    let agent_info = AgentInfo {
        agent: agent.clone(),
        external_profile_hash: external_profile_hash.clone(),
        verified: false,
        registered_at: env.ledger().timestamp(),
        verified_at: None,
        total_ratings: 0,
        total_score: 0,
        completed_agreements: 0,
    };

    env.storage().persistent().set(&key, &agent_info);
    env.storage().persistent().extend_ttl(&key, 500000, 500000);

    let count_key = DataKey::AgentCount;
    let count: u32 = env.storage().persistent().get(&count_key).unwrap_or(0);
    env.storage().persistent().set(&count_key, &(count + 1));
    env.storage()
        .persistent()
        .extend_ttl(&count_key, 500000, 500000);

    events::agent_registered(env, agent, external_profile_hash);

    Ok(())
}

pub fn verify_agent(env: &Env, admin: Address, agent: Address) -> Result<(), AgentError> {
    let state: ContractState = env
        .storage()
        .instance()
        .get(&DataKey::State)
        .ok_or(AgentError::NotInitialized)?;

    admin.require_auth();

    if admin != state.admin {
        return Err(AgentError::Unauthorized);
    }

    let key = DataKey::Agent(agent.clone());
    let mut agent_info: AgentInfo = env
        .storage()
        .persistent()
        .get(&key)
        .ok_or(AgentError::AgentNotFound)?;

    if agent_info.verified {
        return Err(AgentError::AlreadyVerified);
    }

    agent_info.verified = true;
    agent_info.verified_at = Some(env.ledger().timestamp());

    env.storage().persistent().set(&key, &agent_info);
    env.storage().persistent().extend_ttl(&key, 500000, 500000);

    events::agent_verified(env, admin, agent);

    Ok(())
}

pub fn rate_agent(
    env: &Env,
    rater: Address,
    agent: Address,
    score: u32,
    transaction_id: String,
) -> Result<(), AgentError> {
    if !env.storage().persistent().has(&DataKey::Initialized) {
        return Err(AgentError::NotInitialized);
    }

    rater.require_auth();

    if !(1..=5).contains(&score) {
        return Err(AgentError::InvalidRatingScore);
    }

    let agent_key = DataKey::Agent(agent.clone());
    let mut agent_info: AgentInfo = env
        .storage()
        .persistent()
        .get(&agent_key)
        .ok_or(AgentError::AgentNotFound)?;

    if !agent_info.verified {
        return Err(AgentError::AgentNotVerified);
    }

    let txn_key = DataKey::Transaction(transaction_id.clone());
    let transaction: AgentTransaction = env
        .storage()
        .persistent()
        .get(&txn_key)
        .ok_or(AgentError::TransactionNotFound)?;

    if !transaction.completed {
        return Err(AgentError::TransactionNotCompleted);
    }

    if transaction.agent != agent {
        return Err(AgentError::AgentNotFound);
    }

    let mut is_party = false;
    for party in transaction.parties.iter() {
        if party == rater {
            is_party = true;
            break;
        }
    }

    if !is_party {
        return Err(AgentError::NotTransactionParty);
    }

    let rating_key = DataKey::AgentRating(agent.clone(), rater.clone());
    if env.storage().persistent().has(&rating_key) {
        return Err(AgentError::AlreadyRated);
    }

    env.storage().persistent().set(&rating_key, &true);
    env.storage()
        .persistent()
        .extend_ttl(&rating_key, 500000, 500000);

    // Persist the full Rating struct for auditability
    let rating = Rating {
        rater: rater.clone(),
        agent: agent.clone(),
        score,
        rated_at: env.ledger().timestamp(),
    };

    let rating_list_key = DataKey::AgentRatingList(agent.clone());
    let mut ratings: Vec<Rating> = env
        .storage()
        .persistent()
        .get(&rating_list_key)
        .unwrap_or_else(|| Vec::new(env));
    ratings.push_back(rating);
    env.storage().persistent().set(&rating_list_key, &ratings);
    env.storage()
        .persistent()
        .extend_ttl(&rating_list_key, 500000, 500000);

    agent_info.total_ratings += 1;
    agent_info.total_score += score;

    env.storage().persistent().set(&agent_key, &agent_info);
    env.storage()
        .persistent()
        .extend_ttl(&agent_key, 500000, 500000);

    events::agent_rated(env, agent, rater, score);

    Ok(())
}

pub fn get_agent_info(env: &Env, agent: Address) -> Option<AgentInfo> {
    let key = DataKey::Agent(agent);
    env.storage().persistent().get(&key)
}

pub fn get_agent_count(env: &Env) -> u32 {
    env.storage()
        .persistent()
        .get(&DataKey::AgentCount)
        .unwrap_or(0)
}

/// Get all individual ratings for an agent.
/// This allows auditing each rating's score, rater, and timestamp.
///
/// # Arguments
/// * `agent` - The address of the agent
///
/// # Returns
/// * `Vec<Rating>` - A vector of all Rating structs for this agent (empty if none)
pub fn get_agent_ratings(env: &Env, agent: Address) -> Vec<Rating> {
    let key = DataKey::AgentRatingList(agent);
    env.storage().persistent().get(&key).unwrap_or_else(|| Vec::new(env))
}

/// Get the average rating for an agent, scaled by 100.
/// Returns 0 if the agent has no ratings.
///
/// # Arguments
/// * `agent` - The address of the agent
///
/// # Returns
/// * `u32` - The average rating multiplied by 100, or 0 if no ratings exist
///
/// # Example
/// An average of 4.5 returns 450. Divide by 100 for the whole part, modulus 100 for the decimal.
pub fn get_average_rating(env: &Env, agent: Address) -> u32 {
    let key = DataKey::Agent(agent);
    let agent_info: Option<AgentInfo> = env.storage().persistent().get(&key);
    match agent_info {
        Some(info) => info.average_rating(),
        None => 0,
    }
}

pub fn register_transaction(
    env: &Env,
    transaction_id: String,
    agent: Address,
    parties: Vec<Address>,
) -> Result<(), AgentError> {
    if !env.storage().persistent().has(&DataKey::Initialized) {
        return Err(AgentError::NotInitialized);
    }

    let agent_key = DataKey::Agent(agent.clone());
    if !env.storage().persistent().has(&agent_key) {
        return Err(AgentError::AgentNotFound);
    }

    let txn_key = DataKey::Transaction(transaction_id.clone());

    let transaction = AgentTransaction {
        transaction_id: transaction_id.clone(),
        agent: agent.clone(),
        parties,
        completed: false,
    };

    env.storage().persistent().set(&txn_key, &transaction);
    env.storage()
        .persistent()
        .extend_ttl(&txn_key, 500000, 500000);

    events::transaction_registered(env, transaction_id, agent);

    Ok(())
}

pub fn complete_transaction(
    env: &Env,
    transaction_id: String,
    agent: Address,
) -> Result<(), AgentError> {
    if !env.storage().persistent().has(&DataKey::Initialized) {
        return Err(AgentError::NotInitialized);
    }

    let txn_key = DataKey::Transaction(transaction_id.clone());
    let mut transaction: AgentTransaction = env
        .storage()
        .persistent()
        .get(&txn_key)
        .ok_or(AgentError::TransactionNotFound)?;

    if transaction.agent != agent {
        return Err(AgentError::Unauthorized);
    }

    transaction.completed = true;

    env.storage().persistent().set(&txn_key, &transaction);
    env.storage()
        .persistent()
        .extend_ttl(&txn_key, 500000, 500000);

    let agent_key = DataKey::Agent(agent);
    let mut agent_info: AgentInfo = env
        .storage()
        .persistent()
        .get(&agent_key)
        .ok_or(AgentError::AgentNotFound)?;

    agent_info.completed_agreements += 1;

    env.storage().persistent().set(&agent_key, &agent_info);
    env.storage()
        .persistent()
        .extend_ttl(&agent_key, 500000, 500000);

    Ok(())
}
