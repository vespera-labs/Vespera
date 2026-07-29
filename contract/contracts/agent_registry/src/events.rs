use soroban_sdk::{contractevent, Address, Env, String};

#[contractevent(topics = ["initialized"])]
pub struct ContractInitialized {
    #[topic]
    pub admin: Address,
}

#[contractevent(topics = ["agent_reg"])]
pub struct AgentRegistered {
    #[topic]
    pub agent: Address,
    pub external_profile_hash: String,
}

#[contractevent(topics = ["agent_ver"])]
pub struct AgentVerified {
    #[topic]
    pub admin: Address,
    #[topic]
    pub agent: Address,
}

#[contractevent(topics = ["agent_rated"])]
pub struct AgentRated {
    #[topic]
    pub agent: Address,
    #[topic]
    pub rater: Address,
    pub score: u32,
}

#[contractevent(topics = ["txn_reg"])]
pub struct TransactionRegistered {
    #[topic]
    pub transaction_id: String,
    #[topic]
    pub agent: Address,
}

#[contractevent(topics = ["txn_done"])]
pub struct TransactionCompleted {
    #[topic]
    pub transaction_id: String,
    #[topic]
    pub agent: Address,
    /// The agent's running total of completed agreements after this completion.
    pub completed_agreements: u32,
}

#[contractevent(topics = ["paused"])]
pub struct Paused {
    pub reason: String,
    pub paused_by: Address,
}

#[contractevent(topics = ["unpaused"])]
pub struct Unpaused {
    pub unpaused_by: Address,
}

#[contractevent(topics = ["admin_proposed"])]
pub struct AdminProposed {
    pub current_admin: Address,
    pub pending_admin: Address,
}

#[contractevent(topics = ["admin_transferred"])]
pub struct AdminTransferred {
    pub old_admin: Address,
    pub new_admin: Address,
}

pub(crate) fn contract_initialized(env: &Env, admin: Address) {
    ContractInitialized { admin }.publish(env);
}

pub(crate) fn agent_registered(env: &Env, agent: Address, external_profile_hash: String) {
    AgentRegistered {
        agent,
        external_profile_hash,
    }
    .publish(env);
}

pub(crate) fn agent_verified(env: &Env, admin: Address, agent: Address) {
    AgentVerified { admin, agent }.publish(env);
}

pub(crate) fn agent_rated(env: &Env, agent: Address, rater: Address, score: u32) {
    AgentRated {
        agent,
        rater,
        score,
    }
    .publish(env);
}

pub(crate) fn transaction_registered(env: &Env, transaction_id: String, agent: Address) {
    TransactionRegistered {
        transaction_id,
        agent,
    }
    .publish(env);
}

pub(crate) fn transaction_completed(
    env: &Env,
    transaction_id: String,
    agent: Address,
    completed_agreements: u32,
) {
    TransactionCompleted {
        transaction_id,
        agent,
        completed_agreements,
    }
    .publish(env);
}

pub(crate) fn paused(env: &Env, reason: String, paused_by: Address) {
    Paused { reason, paused_by }.publish(env);
}

pub(crate) fn unpaused(env: &Env, unpaused_by: Address) {
    Unpaused { unpaused_by }.publish(env);
}

pub(crate) fn admin_proposed(env: &Env, current_admin: Address, pending_admin: Address) {
    AdminProposed {
        current_admin,
        pending_admin,
    }
    .publish(env);
}

pub(crate) fn admin_transferred(env: &Env, old_admin: Address, new_admin: Address) {
    AdminTransferred {
        old_admin,
        new_admin,
    }
    .publish(env);
}
