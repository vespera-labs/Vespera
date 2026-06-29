
use crate::{
    errors::RentalError,
    events,
    storage::DataKey,
    types::{ActionType, AdminProposal, MultiSigConfig},
};
use soroban_sdk::{Address, Bytes, Env, String, Vec};

const PROPOSAL_EXPIRY_SECONDS: u64 = 7 * 24 * 60 * 60; // 7 days

pub fn initialize_multisig(
    env: &Env,
    admins: Vec<Address>,
    required_signatures: u32,
) -> Result<(), RentalError> {
    if env.storage().instance().has(&DataKey::MultiSigConfig) {
        return Err(RentalError::AlreadyInitialized);
    }
    let total_admins = admins.len();
    if total_admins == 0 { return Err(RentalError::InvalidConfig); }
    if required_signatures == 0 || required_signatures > total_admins {
        return Err(RentalError::InvalidConfig);
    }
    for i in 0..admins.len() {
        for j in (i + 1)..admins.len() {
            if admins.get(i).unwrap() == admins.get(j).unwrap() {
                return Err(RentalError::InvalidConfig);
            }
        }
    }
    let config = MultiSigConfig { admins, required_signatures, total_admins };
    env.storage().instance().set(&DataKey::MultiSigConfig, &config);
    env.storage().instance().extend_ttl(500000, 500000);
    env.storage().instance().set(&DataKey::ProposalCount, &0u32);
    events::multisig_initialized(env, total_admins, required_signatures);
    Ok(())
}

pub fn get_multisig_config(env: &Env) -> Result<MultiSigConfig, RentalError> {
    env.storage().instance().get(&DataKey::MultiSigConfig)
        .ok_or(RentalError::MultiSigNotInitialized)
}

pub fn is_admin(env: &Env, address: &Address) -> Result<bool, RentalError> {
    let config = get_multisig_config(env)?;
    for admin in config.admins.iter() {
        if &admin == address { return Ok(true); }
    }
    Ok(false)
}

pub fn require_admin(env: &Env, caller: &Address) -> Result<(), RentalError> {
    if !is_admin(env, caller)? { return Err(RentalError::Unauthorized); }
    Ok(())
}

/// FIX #65: Each proposal now receives a unique ID by embedding the incrementing
/// proposal_count into the storage key via DataKey::AdminProposalN(u32).
/// Previously all proposals shared DataKey::AdminProposal("prop_"), causing
/// every new proposal to silently overwrite the previous one.
pub fn propose_action(
    env: &Env,
    proposer: Address,
    action_type: ActionType,
    target: Option<Address>,
    data: Bytes,
) -> Result<u32, RentalError> {
    proposer.require_auth();
    require_admin(env, &proposer)?;

    let mut proposal_count: u32 = env.storage().instance()
        .get(&DataKey::ProposalCount).unwrap_or(0);
    proposal_count += 1;

    // FIXED: Use numeric counter as the unique proposal key - no more "prop_" collision.
    let proposal_key = DataKey::AdminProposalN(proposal_count);

    let mut approvals = Vec::new(env);
    approvals.push_back(proposer.clone());

    let proposal = AdminProposal {
        id: proposal_count,
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

    env.storage().persistent().set(&proposal_key, &proposal);
    env.storage().persistent().extend_ttl(&proposal_key, 500000, 500000);
    env.storage().instance().set(&DataKey::ProposalCount, &proposal_count);

    let mut active: Vec<u32> = env.storage().instance()
        .get(&DataKey::ActiveProposals).unwrap_or(Vec::new(env));
    active.push_back(proposal_count);
    env.storage().instance().set(&DataKey::ActiveProposals, &active);

    events::action_proposed(env, proposal_count, proposer, action_type);
    Ok(proposal_count)
}

pub fn approve_proposal(
    env: &Env,
    approver: Address,
    proposal_id: u32,
) -> Result<bool, RentalError> {
    approver.require_auth();
    require_admin(env, &approver)?;

    let proposal_key = DataKey::AdminProposalN(proposal_id);
    let mut proposal: AdminProposal = env.storage().persistent()
        .get(&proposal_key).ok_or(RentalError::ProposalNotFound)?;

    if proposal.executed { return Err(RentalError::ProposalAlreadyExecuted); }
    if env.ledger().timestamp() > proposal.expiry { return Err(RentalError::ProposalExpired); }

    for existing in proposal.approvals.iter() {
        if existing == approver { return Err(RentalError::AlreadyApproved); }
    }

    proposal.approvals.push_back(approver.clone());
    proposal.approval_count += 1;
    env.storage().persistent().set(&proposal_key, &proposal);

    let config = get_multisig_config(env)?;
    let threshold_met = proposal.approval_count >= config.required_signatures;
    events::proposal_approved(env, proposal_id, approver, proposal.approval_count);
    Ok(threshold_met)
}

pub fn execute_proposal(
    env: &Env,
    executor: Address,
    proposal_id: u32,
) -> Result<AdminProposal, RentalError> {
    executor.require_auth();
    require_admin(env, &executor)?;

    let proposal_key = DataKey::AdminProposalN(proposal_id);
    let mut proposal: AdminProposal = env.storage().persistent()
        .get(&proposal_key).ok_or(RentalError::ProposalNotFound)?;

    if proposal.executed { return Err(RentalError::ProposalAlreadyExecuted); }
    if env.ledger().timestamp() > proposal.expiry { return Err(RentalError::ProposalExpired); }

    let config = get_multisig_config(env)?;
    if proposal.approval_count < config.required_signatures {
        return Err(RentalError::InsufficientApprovals);
    }

    proposal.executed = true;
    env.storage().persistent().set(&proposal_key, &proposal);

    let mut active: Vec<u32> = env.storage().instance()
        .get(&DataKey::ActiveProposals).unwrap_or(Vec::new(env));
    let mut new_active = Vec::new(env);
    for id in active.iter() { if id != proposal_id { new_active.push_back(id); } }
    env.storage().instance().set(&DataKey::ActiveProposals, &new_active);

    events::action_executed(env, proposal_id, executor);
    Ok(proposal.clone())
}

pub fn add_admin_internal(env: &Env, new_admin: Address) -> Result<(), RentalError> {
    let mut config = get_multisig_config(env)?;
    for admin in config.admins.iter() {
        if admin == new_admin { return Err(RentalError::InvalidInput); }
    }
    config.admins.push_back(new_admin.clone());
    config.total_admins += 1;
    env.storage().instance().set(&DataKey::MultiSigConfig, &config);
    env.storage().instance().extend_ttl(500000, 500000);
    events::admin_added(env, new_admin, config.total_admins);
    Ok(())
}

pub fn remove_admin_internal(env: &Env, admin_to_remove: Address) -> Result<(), RentalError> {
    let mut config = get_multisig_config(env)?;
    if config.total_admins <= 1 { return Err(RentalError::InvalidConfig); }
    let mut found = false;
    let mut new_admins = Vec::new(env);
    for admin in config.admins.iter() {
        if admin == admin_to_remove { found = true; } else { new_admins.push_back(admin); }
    }
    if !found { return Err(RentalError::Unauthorized); }
    config.admins = new_admins;
    config.total_admins -= 1;
    if config.required_signatures > config.total_admins {
        config.required_signatures = config.total_admins;
    }
    env.storage().instance().set(&DataKey::MultiSigConfig, &config);
    env.storage().instance().extend_ttl(500000, 500000);
    events::admin_removed(env, admin_to_remove, config.total_admins);
    Ok(())
}

pub fn update_required_signatures_internal(env: &Env, new_required: u32) -> Result<(), RentalError> {
    let mut config = get_multisig_config(env)?;
    if new_required == 0 || new_required > config.total_admins { return Err(RentalError::InvalidConfig); }
    let old_required = config.required_signatures;
    config.required_signatures = new_required;
    env.storage().instance().set(&DataKey::MultiSigConfig, &config);
    env.storage().instance().extend_ttl(500000, 500000);
    events::required_signatures_updated(env, old_required, new_required);
    Ok(())
}

pub fn get_proposal(env: &Env, proposal_id: u32) -> Result<AdminProposal, RentalError> {
    env.storage().persistent().get(&DataKey::AdminProposalN(proposal_id))
        .ok_or(RentalError::ProposalNotFound)
}

pub fn get_active_proposals(env: &Env) -> Result<Vec<u32>, RentalError> {
    Ok(env.storage().instance().get(&DataKey::ActiveProposals).unwrap_or(Vec::new(env)))
}

pub fn get_proposal_count(env: &Env) -> u32 {
    env.storage().instance().get(&DataKey::ProposalCount).unwrap_or(0)
}
