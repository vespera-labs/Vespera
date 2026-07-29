//! Tests for multi-sig governance and timelock execution (Issue #654)
#![allow(unused_results)]

use crate::{
    errors::RentalError,
    types::{ActionType, Config},
    Contract, ContractClient,
};
use soroban_sdk::{testutils::Address as _, Address, Bytes, Env, String, Vec};

fn create_contract() -> (Env, ContractClient<'static>, Address) {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(Contract, ());
    let client = ContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let fee_collector = Address::generate(&env);

    let config = Config {
        fee_bps: 100,
        fee_collector,
        paused: false,
    };

    client.initialize(&admin, &config);

    (env, client, admin)
}

// ─── Multi-Sig Initialization Tests ────────────────────────────────────────

#[test]
fn test_initialize_multisig_with_multiple_admins() {
    let (env, client, _admin) = create_contract();

    let admin1 = Address::generate(&env);
    let admin2 = Address::generate(&env);
    let admin3 = Address::generate(&env);

    let mut admins = Vec::new(&env);
    admins.push_back(admin1.clone());
    admins.push_back(admin2.clone());
    admins.push_back(admin3.clone());

    let result = client.try_initialize_multisig(&admins, &2);
    assert!(result.is_ok());
}

#[test]
fn test_get_multisig_config() {
    let (env, client, _admin) = create_contract();

    let admin1 = Address::generate(&env);
    let admin2 = Address::generate(&env);

    let mut admins = Vec::new(&env);
    admins.push_back(admin1.clone());
    admins.push_back(admin2.clone());

    let _ = client.try_initialize_multisig(&admins, &2).unwrap();

    let config = client.try_get_multisig_config().unwrap().unwrap();
    assert_eq!(config.total_admins, 2);
    assert_eq!(config.required_signatures, 2);
}

#[test]
fn test_is_admin_check() {
    let (env, client, _admin) = create_contract();

    let admin1 = Address::generate(&env);
    let admin2 = Address::generate(&env);
    let non_admin = Address::generate(&env);

    let mut admins = Vec::new(&env);
    admins.push_back(admin1.clone());
    admins.push_back(admin2.clone());

    let _ = client.try_initialize_multisig(&admins, &2).unwrap();

    let is_admin1 = client.try_is_admin(&admin1).unwrap().unwrap();
    assert!(is_admin1);

    let is_non_admin = client.try_is_admin(&non_admin).unwrap().unwrap();
    assert!(!is_non_admin);
}

// ─── Proposal Management Tests ─────────────────────────────────────────────

#[test]
fn test_propose_add_admin() {
    let (env, client, _admin) = create_contract();

    let admin1 = Address::generate(&env);
    let admin2 = Address::generate(&env);
    let new_admin = Address::generate(&env);

    let mut admins = Vec::new(&env);
    admins.push_back(admin1.clone());
    admins.push_back(admin2.clone());

    let _ = client.try_initialize_multisig(&admins, &2).unwrap();

    let data = Bytes::new(&env);
    let result = client.try_propose_action(
        &admin1,
        &ActionType::AddAdmin,
        &Some(new_admin.clone()),
        &data,
    );

    assert!(result.is_ok());
}

#[test]
fn test_propose_remove_admin() {
    let (env, client, _admin) = create_contract();

    let admin1 = Address::generate(&env);
    let admin2 = Address::generate(&env);

    let mut admins = Vec::new(&env);
    admins.push_back(admin1.clone());
    admins.push_back(admin2.clone());

    let _ = client.try_initialize_multisig(&admins, &2).unwrap();

    let data = Bytes::new(&env);
    let result = client.try_propose_action(
        &admin1,
        &ActionType::RemoveAdmin,
        &Some(admin2.clone()),
        &data,
    );

    assert!(result.is_ok());
}

#[test]
fn test_admin_governance_requires_multisig_approval() {
    let (env, client, _admin) = create_contract();

    let admin1 = Address::generate(&env);
    let admin2 = Address::generate(&env);
    let non_admin = Address::generate(&env);

    let mut admins = Vec::new(&env);
    admins.push_back(admin1.clone());
    admins.push_back(admin2.clone());

    let _ = client.try_initialize_multisig(&admins, &2).unwrap();

    let data = Bytes::new(&env);
    let remove_result = client.try_propose_action(
        &non_admin,
        &ActionType::RemoveAdmin,
        &Some(admin2.clone()),
        &data,
    );
    assert!(remove_result.is_err());

    let required_data = Bytes::from_slice(&env, &2u32.to_be_bytes());
    let required_result = client.try_propose_action(
        &non_admin,
        &ActionType::UpdateRequiredSignatures,
        &None,
        &required_data,
    );
    assert!(required_result.is_err());

    let proposal_data = Bytes::new(&env);
    let remove_proposal = client
        .try_propose_action(
            &admin1,
            &ActionType::RemoveAdmin,
            &Some(admin2.clone()),
            &proposal_data,
        )
        .unwrap()
        .unwrap();
    let exec_remove = client.try_execute_action(&admin1, &remove_proposal);
    assert!(exec_remove.is_err());

    let update_proposal = client
        .try_propose_action(
            &admin1,
            &ActionType::UpdateRequiredSignatures,
            &None,
            &required_data,
        )
        .unwrap()
        .unwrap();
    let exec_update = client.try_execute_action(&admin1, &update_proposal);
    assert!(exec_update.is_err());
}

#[test]
fn test_get_active_proposals() {
    let (env, client, _admin) = create_contract();

    let admin1 = Address::generate(&env);
    let admin2 = Address::generate(&env);
    let new_admin = Address::generate(&env);

    let mut admins = Vec::new(&env);
    admins.push_back(admin1.clone());
    admins.push_back(admin2.clone());

    let _ = client.try_initialize_multisig(&admins, &2).unwrap();

    let data = Bytes::new(&env);
    let _ = client
        .try_propose_action(
            &admin1,
            &ActionType::AddAdmin,
            &Some(new_admin.clone()),
            &data,
        )
        .unwrap();

    let proposals = client.try_get_active_proposals().unwrap().unwrap();
    assert!(!proposals.is_empty());
}

// ─── Proposal Voting Tests ────────────────────────────────────────────────

#[test]
fn test_approve_action() {
    let (env, client, _admin) = create_contract();

    let admin1 = Address::generate(&env);
    let admin2 = Address::generate(&env);
    let new_admin = Address::generate(&env);

    let mut admins = Vec::new(&env);
    admins.push_back(admin1.clone());
    admins.push_back(admin2.clone());

    let _ = client.try_initialize_multisig(&admins, &2).unwrap();

    let data = Bytes::new(&env);
    let proposal_id = client
        .try_propose_action(
            &admin1,
            &ActionType::AddAdmin,
            &Some(new_admin.clone()),
            &data,
        )
        .unwrap()
        .unwrap();

    let result = client.try_approve_action(&admin2, &proposal_id);
    assert!(result.is_ok());
}

#[test]
fn test_prevent_duplicate_approval() {
    let (env, client, _admin) = create_contract();

    let admin1 = Address::generate(&env);
    let admin2 = Address::generate(&env);
    let new_admin = Address::generate(&env);

    let mut admins = Vec::new(&env);
    admins.push_back(admin1.clone());
    admins.push_back(admin2.clone());

    let _ = client.try_initialize_multisig(&admins, &2).unwrap();

    let data = Bytes::new(&env);
    let proposal_id = client
        .try_propose_action(
            &admin1,
            &ActionType::AddAdmin,
            &Some(new_admin.clone()),
            &data,
        )
        .unwrap()
        .unwrap();

    let _ = client.try_approve_action(&admin2, &proposal_id).unwrap();

    let result = client.try_approve_action(&admin2, &proposal_id);
    assert!(result.is_err());
}

#[test]
fn test_reject_action() {
    let (env, client, _admin) = create_contract();

    let admin1 = Address::generate(&env);
    let admin2 = Address::generate(&env);
    let new_admin = Address::generate(&env);

    let mut admins = Vec::new(&env);
    admins.push_back(admin1.clone());
    admins.push_back(admin2.clone());

    let _ = client.try_initialize_multisig(&admins, &2).unwrap();

    let data = Bytes::new(&env);
    let proposal_id = client
        .try_propose_action(
            &admin1,
            &ActionType::AddAdmin,
            &Some(new_admin.clone()),
            &data,
        )
        .unwrap()
        .unwrap();

    let result = client.try_reject_action(&admin1, &proposal_id);
    assert!(result.is_ok());
}

// ─── Proposal Execution Tests ─────────────────────────────────────────────

#[test]
fn test_execute_approved_proposal() {
    let (env, client, _admin) = create_contract();

    let admin1 = Address::generate(&env);
    let admin2 = Address::generate(&env);
    let new_admin = Address::generate(&env);

    let mut admins = Vec::new(&env);
    admins.push_back(admin1.clone());
    admins.push_back(admin2.clone());

    let _ = client.try_initialize_multisig(&admins, &2).unwrap();

    let data = Bytes::new(&env);
    let proposal_id = client
        .try_propose_action(
            &admin1,
            &ActionType::AddAdmin,
            &Some(new_admin.clone()),
            &data,
        )
        .unwrap()
        .unwrap();

    let _ = client.try_approve_action(&admin2, &proposal_id).unwrap();

    let result = client.try_execute_action(&admin1, &proposal_id);
    assert!(result.is_ok());
}

#[test]
fn test_execute_add_admin_proposal() {
    let (env, client, _admin) = create_contract();

    let admin1 = Address::generate(&env);
    let admin2 = Address::generate(&env);
    let new_admin = Address::generate(&env);

    let mut admins = Vec::new(&env);
    admins.push_back(admin1.clone());
    admins.push_back(admin2.clone());

    let _ = client.try_initialize_multisig(&admins, &2).unwrap();

    let data = Bytes::new(&env);
    let proposal_id = client
        .try_propose_action(
            &admin1,
            &ActionType::AddAdmin,
            &Some(new_admin.clone()),
            &data,
        )
        .unwrap()
        .unwrap();

    let _ = client.try_approve_action(&admin2, &proposal_id).unwrap();
    let result = client.try_execute_action(&admin1, &proposal_id);
    assert!(result.is_ok());
}

#[test]
fn test_prevent_execution_without_approvals() {
    let (env, client, _admin) = create_contract();

    let admin1 = Address::generate(&env);
    let admin2 = Address::generate(&env);
    let new_admin = Address::generate(&env);

    let mut admins = Vec::new(&env);
    admins.push_back(admin1.clone());
    admins.push_back(admin2.clone());

    let _ = client.try_initialize_multisig(&admins, &2).unwrap();

    let data = Bytes::new(&env);
    let proposal_id = client
        .try_propose_action(
            &admin1,
            &ActionType::AddAdmin,
            &Some(new_admin.clone()),
            &data,
        )
        .unwrap()
        .unwrap();

    let result = client.try_execute_action(&admin1, &proposal_id);
    assert!(result.is_err());
}

#[test]
fn test_prevent_double_execution() {
    let (env, client, _admin) = create_contract();

    let admin1 = Address::generate(&env);
    let admin2 = Address::generate(&env);
    let new_admin = Address::generate(&env);

    let mut admins = Vec::new(&env);
    admins.push_back(admin1.clone());
    admins.push_back(admin2.clone());

    let _ = client.try_initialize_multisig(&admins, &2).unwrap();

    let data = Bytes::new(&env);
    let proposal_id = client
        .try_propose_action(
            &admin1,
            &ActionType::AddAdmin,
            &Some(new_admin.clone()),
            &data,
        )
        .unwrap()
        .unwrap();

    let _ = client.try_approve_action(&admin2, &proposal_id).unwrap();
    let _ = client.try_execute_action(&admin1, &proposal_id).unwrap();

    let result = client.try_execute_action(&admin1, &proposal_id);
    assert!(result.is_err());
}

// ─── Edge Cases ────────────────────────────────────────────────────────────

#[test]
fn test_single_admin_multisig() {
    let (env, client, _admin) = create_contract();

    let admin1 = Address::generate(&env);

    let mut admins = Vec::new(&env);
    admins.push_back(admin1.clone());

    let result = client.try_initialize_multisig(&admins, &1);
    assert!(result.is_ok());
}

#[test]
fn test_all_admins_approve() {
    let (env, client, _admin) = create_contract();

    let admin1 = Address::generate(&env);
    let admin2 = Address::generate(&env);
    let admin3 = Address::generate(&env);
    let new_admin = Address::generate(&env);

    let mut admins = Vec::new(&env);
    admins.push_back(admin1.clone());
    admins.push_back(admin2.clone());
    admins.push_back(admin3.clone());

    let _ = client.try_initialize_multisig(&admins, &2).unwrap();

    let data = Bytes::new(&env);
    let proposal_id = client
        .try_propose_action(
            &admin1,
            &ActionType::AddAdmin,
            &Some(new_admin.clone()),
            &data,
        )
        .unwrap()
        .unwrap();

    let _ = client.try_approve_action(&admin2, &proposal_id).unwrap();
    let _ = client.try_approve_action(&admin3, &proposal_id).unwrap();

    let result = client.try_execute_action(&admin1, &proposal_id);
    assert!(result.is_ok());
}

// ─── Unique Proposal ID Tests (Issue #65) ──────────────────────────────────

/// Two proposals created in sequence must be stored under distinct keys and
/// both remain independently retrievable from the active proposal list.
#[test]
fn test_proposals_have_distinct_ids() {
    let (env, client, _admin) = create_contract();

    let admin1 = Address::generate(&env);
    let admin2 = Address::generate(&env);
    let target_a = Address::generate(&env);
    let target_b = Address::generate(&env);

    let mut admins = Vec::new(&env);
    admins.push_back(admin1.clone());
    admins.push_back(admin2.clone());

    let _ = client.try_initialize_multisig(&admins, &2).unwrap();

    let data = Bytes::new(&env);
    let id1 = client
        .try_propose_action(
            &admin1,
            &ActionType::AddAdmin,
            &Some(target_a.clone()),
            &data,
        )
        .unwrap()
        .unwrap();
    let id2 = client
        .try_propose_action(
            &admin1,
            &ActionType::AddAdmin,
            &Some(target_b.clone()),
            &data,
        )
        .unwrap()
        .unwrap();

    // Distinct ids: the second proposal no longer overwrites the first.
    assert!(id1 != id2);

    // Both proposals are stored and individually retrievable.
    let prop1 = client.try_get_proposal(&id1).unwrap().unwrap();
    let prop2 = client.try_get_proposal(&id2).unwrap().unwrap();
    assert_eq!(prop1.target, Some(target_a));
    assert_eq!(prop2.target, Some(target_b));

    // The active list tracks both distinct ids.
    let active = client.try_get_active_proposals().unwrap().unwrap();
    assert_eq!(active.len(), 2);
    assert!(active.contains(&id1));
    assert!(active.contains(&id2));

    assert_eq!(client.try_get_proposal_count().unwrap().unwrap(), 2);
}

/// Acceptance #4: executing one proposal must not affect another. The second
/// proposal stays pending and unmodified while the first is executed.
#[test]
fn test_execute_one_proposal_does_not_affect_other() {
    let (env, client, _admin) = create_contract();

    let admin1 = Address::generate(&env);
    let admin2 = Address::generate(&env);
    let new_admin1 = Address::generate(&env);
    let new_admin2 = Address::generate(&env);

    let mut admins = Vec::new(&env);
    admins.push_back(admin1.clone());
    admins.push_back(admin2.clone());

    let _ = client.try_initialize_multisig(&admins, &2).unwrap();

    let data = Bytes::new(&env);
    let id1 = client
        .try_propose_action(
            &admin1,
            &ActionType::AddAdmin,
            &Some(new_admin1.clone()),
            &data,
        )
        .unwrap()
        .unwrap();
    let id2 = client
        .try_propose_action(
            &admin1,
            &ActionType::AddAdmin,
            &Some(new_admin2.clone()),
            &data,
        )
        .unwrap()
        .unwrap();

    // Approve and execute only the first proposal.
    let _ = client.try_approve_action(&admin2, &id1).unwrap();
    let _ = client.try_execute_action(&admin1, &id1).unwrap();

    // First proposal is executed.
    let prop1 = client.try_get_proposal(&id1).unwrap().unwrap();
    assert!(prop1.executed);

    // Second proposal is untouched: still pending, single (proposer) approval.
    let prop2 = client.try_get_proposal(&id2).unwrap().unwrap();
    assert!(!prop2.executed);
    assert_eq!(prop2.approval_count, 1);
    assert_eq!(prop2.target, Some(new_admin2));

    // The second proposal can still be executed independently afterwards.
    let _ = client.try_approve_action(&admin2, &id2).unwrap();
    let result = client.try_execute_action(&admin1, &id2);
    assert!(result.is_ok());
}

// ─── Execution Actually Applies State (Issue #66/#227) ─────────────────────
//
// `execute_action` used to mark a proposal `executed` and emit an event
// without ever dispatching on `action_type`, so a fully-approved Pause /
// AddToken / UpdateConfig had no effect. These tests assert the targeted
// on-chain state actually changed.

#[test]
fn test_execute_pause_proposal_actually_pauses() {
    let (env, client, _admin) = create_contract();

    let admin1 = Address::generate(&env);
    let admin2 = Address::generate(&env);

    let mut admins = Vec::new(&env);
    admins.push_back(admin1.clone());
    admins.push_back(admin2.clone());

    let _ = client.try_initialize_multisig(&admins, &2).unwrap();

    assert!(!client.is_paused());

    let data = Bytes::new(&env);
    let proposal_id = client
        .try_propose_action(&admin1, &ActionType::Pause, &None, &data)
        .unwrap()
        .unwrap();
    let _ = client.try_approve_action(&admin2, &proposal_id).unwrap();

    let result = client.try_execute_action(&admin1, &proposal_id);
    assert!(result.is_ok());

    assert!(client.is_paused());
}

#[test]
fn test_execute_unpause_proposal_actually_unpauses() {
    let (env, client, _admin) = create_contract();

    let admin1 = Address::generate(&env);
    let admin2 = Address::generate(&env);

    let mut admins = Vec::new(&env);
    admins.push_back(admin1.clone());
    admins.push_back(admin2.clone());

    let _ = client.try_initialize_multisig(&admins, &2).unwrap();

    client.pause(&String::from_str(&env, "manual pause"));
    assert!(client.is_paused());

    let data = Bytes::new(&env);
    let proposal_id = client
        .try_propose_action(&admin1, &ActionType::Unpause, &None, &data)
        .unwrap()
        .unwrap();
    let _ = client.try_approve_action(&admin2, &proposal_id).unwrap();

    let result = client.try_execute_action(&admin1, &proposal_id);
    assert!(result.is_ok());

    assert!(!client.is_paused());
}

#[test]
fn test_execute_update_config_proposal_actually_updates_config() {
    let (env, client, _admin) = create_contract();

    let admin1 = Address::generate(&env);
    let admin2 = Address::generate(&env);
    let new_fee_collector = Address::generate(&env);

    let mut admins = Vec::new(&env);
    admins.push_back(admin1.clone());
    admins.push_back(admin2.clone());

    let _ = client.try_initialize_multisig(&admins, &2).unwrap();

    // Payload: [fee_bps: u32 BE][paused: u8]
    let mut data = Bytes::from_array(&env, &500u32.to_be_bytes());
    data.push_back(0);

    let proposal_id = client
        .try_propose_action(
            &admin1,
            &ActionType::UpdateConfig,
            &Some(new_fee_collector.clone()),
            &data,
        )
        .unwrap()
        .unwrap();
    let _ = client.try_approve_action(&admin2, &proposal_id).unwrap();

    let result = client.try_execute_action(&admin1, &proposal_id);
    assert!(result.is_ok());

    let state = client.get_state().unwrap();
    assert_eq!(state.config.fee_bps, 500);
    assert_eq!(state.config.fee_collector, new_fee_collector);
}

#[test]
fn test_execute_update_config_malformed_data_fails() {
    let (env, client, _admin) = create_contract();

    let admin1 = Address::generate(&env);
    let admin2 = Address::generate(&env);
    let fee_collector = Address::generate(&env);

    let mut admins = Vec::new(&env);
    admins.push_back(admin1.clone());
    admins.push_back(admin2.clone());

    let _ = client.try_initialize_multisig(&admins, &2).unwrap();

    // Too short to decode as [fee_bps: u32][paused: u8].
    let data = Bytes::from_array(&env, &[1, 2, 3]);

    let proposal_id = client
        .try_propose_action(
            &admin1,
            &ActionType::UpdateConfig,
            &Some(fee_collector),
            &data,
        )
        .unwrap()
        .unwrap();
    let _ = client.try_approve_action(&admin2, &proposal_id).unwrap();

    let result = client.try_execute_action(&admin1, &proposal_id);
    assert_eq!(result, Err(Ok(RentalError::InvalidInput)));

    // The malformed proposal is not silently marked executed.
    let proposal = client.try_get_proposal(&proposal_id).unwrap().unwrap();
    assert!(!proposal.executed);
}

#[test]
fn test_execute_add_token_proposal_actually_adds_token() {
    let (env, client, _admin) = create_contract();

    let admin1 = Address::generate(&env);
    let admin2 = Address::generate(&env);
    let token_address = Address::generate(&env);

    let mut admins = Vec::new(&env);
    admins.push_back(admin1.clone());
    admins.push_back(admin2.clone());

    let _ = client.try_initialize_multisig(&admins, &2).unwrap();

    assert!(!client
        .try_is_token_supported(&token_address)
        .unwrap()
        .unwrap());

    // Payload: [symbol_len: u8]["USDX"][decimals: u32 BE][min: i128 BE][max: i128 BE]
    let symbol = "USDX";
    let mut data = Bytes::new(&env);
    data.push_back(symbol.len() as u8);
    data.extend_from_slice(symbol.as_bytes());
    data.extend_from_array(&7u32.to_be_bytes());
    data.extend_from_array(&1i128.to_be_bytes());
    data.extend_from_array(&1_000_000i128.to_be_bytes());

    let proposal_id = client
        .try_propose_action(
            &admin1,
            &ActionType::AddToken,
            &Some(token_address.clone()),
            &data,
        )
        .unwrap()
        .unwrap();
    let _ = client.try_approve_action(&admin2, &proposal_id).unwrap();

    let result = client.try_execute_action(&admin1, &proposal_id);
    assert!(result.is_ok());

    assert!(client
        .try_is_token_supported(&token_address)
        .unwrap()
        .unwrap());
    let tokens = client.try_get_supported_tokens().unwrap().unwrap();
    let added = tokens
        .iter()
        .find(|t| t.token_address == token_address)
        .expect("token should be in supported tokens list");
    assert_eq!(added.symbol, String::from_str(&env, symbol));
    assert_eq!(added.decimals, 7);
    assert_eq!(added.min_amount, 1);
    assert_eq!(added.max_amount, 1_000_000);
}

#[test]
fn test_execute_remove_token_proposal_actually_removes_token() {
    let (env, client, _admin) = create_contract();

    let admin1 = Address::generate(&env);
    let admin2 = Address::generate(&env);
    let token_address = Address::generate(&env);

    let mut admins = Vec::new(&env);
    admins.push_back(admin1.clone());
    admins.push_back(admin2.clone());

    let _ = client.try_initialize_multisig(&admins, &2).unwrap();

    client.add_supported_token(
        &token_address,
        &String::from_str(&env, "USDX"),
        &7,
        &1,
        &1_000_000,
    );
    assert!(client
        .try_is_token_supported(&token_address)
        .unwrap()
        .unwrap());

    let data = Bytes::new(&env);
    let proposal_id = client
        .try_propose_action(
            &admin1,
            &ActionType::RemoveToken,
            &Some(token_address.clone()),
            &data,
        )
        .unwrap()
        .unwrap();
    let _ = client.try_approve_action(&admin2, &proposal_id).unwrap();

    let result = client.try_execute_action(&admin1, &proposal_id);
    assert!(result.is_ok());

    assert!(!client
        .try_is_token_supported(&token_address)
        .unwrap()
        .unwrap());
}
