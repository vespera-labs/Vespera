//! Tests for the Chioma/Rental contract.

use super::*;
use soroban_sdk::{
    testutils::{Address as _, Events, Ledger},
    vec, Address, Env, String,
};

#[test]
fn test_hello() {
    let env = Env::default();
    let contract_id = env.register(Contract, ());
    let client = ContractClient::new(&env, &contract_id);

    let words = client.hello(&String::from_str(&env, "Dev"));
    assert_eq!(
        words,
        vec![
            &env,
            String::from_str(&env, "Hello"),
            String::from_str(&env, "Dev"),
        ]
    );
}

fn create_contract(env: &Env) -> ContractClient<'_> {
    let contract_id = env.register(Contract, ());
    ContractClient::new(env, &contract_id)
}

#[test]
fn test_create_agreement_success() {
    let env = Env::default();
    env.mock_all_auths();

    let client = create_contract(&env);

    let tenant = Address::generate(&env);
    let landlord = Address::generate(&env);
    let agent = Some(Address::generate(&env));

    let agreement_id = String::from_str(&env, "AGREEMENT_001");

    client.create_agreement(
        &agreement_id,
        &landlord,
        &tenant,
        &agent,
        &1000, // monthly_rent
        &2000, // security_deposit
        &100,  // start_date
        &200,  // end_date
        &10,   // agent_commission_rate
        &Address::generate(&env),
    );

    // Check events
    let events = env.events().all();
    assert_eq!(events.len(), 1);
    let event = events.last().unwrap();
    assert_eq!(event.1.len(), 1);
}

#[test]
fn test_create_agreement_with_agent() {
    let env = Env::default();
    env.mock_all_auths();

    let client = create_contract(&env);

    let tenant = Address::generate(&env);
    let landlord = Address::generate(&env);
    let agent = Address::generate(&env);

    let agreement_id = String::from_str(&env, "AGREEMENT_WITH_AGENT");

    client.create_agreement(
        &agreement_id,
        &landlord,
        &tenant,
        &Some(agent.clone()),
        &1500,
        &3000,
        &1000,
        &2000,
        &5,
        &Address::generate(&env),
    );
}

#[test]
fn test_create_agreement_without_agent() {
    let env = Env::default();
    env.mock_all_auths();

    let client = create_contract(&env);

    let tenant = Address::generate(&env);
    let landlord = Address::generate(&env);

    let agreement_id = String::from_str(&env, "AGREEMENT_NO_AGENT");

    client.create_agreement(
        &agreement_id,
        &landlord,
        &tenant,
        &None,
        &1200,
        &2400,
        &500,
        &1500,
        &0,
        &Address::generate(&env),
    );
}

#[test]
#[should_panic(expected = "Error(Contract, #5)")]
fn test_negative_rent_rejected() {
    let env = Env::default();
    env.mock_all_auths();

    let client = create_contract(&env);

    let tenant = Address::generate(&env);
    let landlord = Address::generate(&env);

    let agreement_id = String::from_str(&env, "BAD_RENT");

    client.create_agreement(
        &agreement_id,
        &landlord,
        &tenant,
        &None,
        &-100, // Negative rent
        &1000,
        &100,
        &200,
        &0,
        &Address::generate(&env),
    );
}

#[test]
#[should_panic(expected = "Error(Contract, #6)")]
fn test_invalid_dates_rejected() {
    let env = Env::default();
    env.mock_all_auths();

    let client = create_contract(&env);

    let tenant = Address::generate(&env);
    let landlord = Address::generate(&env);

    let agreement_id = String::from_str(&env, "BAD_DATES");

    client.create_agreement(
        &agreement_id,
        &landlord,
        &tenant,
        &None,
        &1000,
        &2000,
        &200, // start_date
        &100, // end_date < start_date
        &0,
        &Address::generate(&env),
    );
}

#[test]
#[should_panic(expected = "Error(Contract, #4)")]
fn test_duplicate_agreement_id() {
    let env = Env::default();
    env.mock_all_auths();

    let client = create_contract(&env);

    let tenant = Address::generate(&env);
    let landlord = Address::generate(&env);

    let agreement_id = String::from_str(&env, "DUPLICATE_ID");

    client.create_agreement(
        &agreement_id,
        &landlord,
        &tenant,
        &None,
        &1000,
        &2000,
        &100,
        &200,
        &0,
        &Address::generate(&env),
    );

    // Try to create again with same ID
    client.create_agreement(
        &agreement_id,
        &landlord,
        &tenant,
        &None,
        &1000,
        &2000,
        &100,
        &200,
        &0,
        &Address::generate(&env),
    );
}

#[test]
#[should_panic(expected = "Error(Contract, #7)")]
fn test_invalid_commission_rate() {
    let env = Env::default();
    env.mock_all_auths();

    let client = create_contract(&env);

    let tenant = Address::generate(&env);
    let landlord = Address::generate(&env);

    let agreement_id = String::from_str(&env, "BAD_COMMISSION");

    client.create_agreement(
        &agreement_id,
        &landlord,
        &tenant,
        &None,
        &1000,
        &2000,
        &100,
        &200,
        &101, // > 100
        &Address::generate(&env),
    );
}

// Helper function to create a test agreement in Pending status
fn create_pending_agreement(
    env: &Env,
    client: &ContractClient,
    agreement_id: &str,
    tenant: &Address,
    landlord: &Address,
) {
    // First create the agreement
    client.create_agreement(
        &String::from_str(env, agreement_id),
        landlord,
        tenant,
        &None,
        &1000,
        &2000,
        &100,
        &1000000, // far future end_date to avoid expiration
        &0,
        &Address::generate(env),
    );

    // Update status to Pending manually
    let mut agreement = client
        .get_agreement(&String::from_str(env, agreement_id))
        .unwrap();
    agreement.status = AgreementStatus::Pending;

    env.as_contract(&client.address, || {
        env.storage().persistent().set(
            &storage::DataKey::Agreement(String::from_str(env, agreement_id)),
            &agreement,
        );
    });
}

#[test]
fn test_sign_agreement_success() {
    let env = Env::default();
    env.mock_all_auths();

    let client = create_contract(&env);
    let tenant = Address::generate(&env);
    let landlord = Address::generate(&env);

    let agreement_id = "SIGN_001";
    create_pending_agreement(&env, &client, agreement_id, &tenant, &landlord);

    // Tenant signs the agreement
    client.sign_agreement(&tenant, &String::from_str(&env, agreement_id));

    // Verify agreement is now Active
    let agreement = client
        .get_agreement(&String::from_str(&env, agreement_id))
        .unwrap();
    assert_eq!(agreement.status, AgreementStatus::Active);
    assert!(agreement.signed_at.is_some());
    assert_eq!(agreement.tenant, tenant);
}

#[test]
#[should_panic(expected = "Error(Contract, #13)")]
fn test_sign_agreement_not_found() {
    let env = Env::default();
    env.mock_all_auths();

    let client = create_contract(&env);
    let tenant = Address::generate(&env);

    // Try to sign non-existent agreement
    client.sign_agreement(&tenant, &String::from_str(&env, "NONEXISTENT"));
}

#[test]
#[should_panic(expected = "Error(Contract, #14)")]
fn test_sign_agreement_not_tenant() {
    let env = Env::default();
    env.mock_all_auths();

    let client = create_contract(&env);
    let tenant = Address::generate(&env);
    let landlord = Address::generate(&env);
    let impostor = Address::generate(&env);

    let agreement_id = "SIGN_002";
    create_pending_agreement(&env, &client, agreement_id, &tenant, &landlord);

    // Try to sign with wrong tenant
    client.sign_agreement(&impostor, &String::from_str(&env, agreement_id));
}

#[test]
#[should_panic(expected = "Error(Contract, #15)")]
fn test_sign_agreement_invalid_state() {
    let env = Env::default();
    env.mock_all_auths();

    let client = create_contract(&env);
    let tenant = Address::generate(&env);
    let landlord = Address::generate(&env);

    let agreement_id = "SIGN_003";

    // Create agreement in Draft status (not Pending)
    client.create_agreement(
        &String::from_str(&env, agreement_id),
        &landlord,
        &tenant,
        &None,
        &1000,
        &2000,
        &100,
        &1000000,
        &0,
        &Address::generate(&env),
    );

    // Try to sign agreement in Draft state
    client.sign_agreement(&tenant, &String::from_str(&env, agreement_id));
}

#[test]
#[should_panic(expected = "Error(Contract, #16)")]
fn test_sign_agreement_expired() {
    let env = Env::default();
    env.mock_all_auths();

    let client = create_contract(&env);
    let tenant = Address::generate(&env);
    let landlord = Address::generate(&env);

    let agreement_id = "SIGN_004";

    // Create agreement with end_date
    client.create_agreement(
        &String::from_str(&env, agreement_id),
        &landlord,
        &tenant,
        &None,
        &1000,
        &2000,
        &100,
        &200, // end_date = 200
        &0,
        &Address::generate(&env),
    );

    // Update status to Pending
    let mut agreement = client
        .get_agreement(&String::from_str(&env, agreement_id))
        .unwrap();
    agreement.status = AgreementStatus::Pending;

    env.as_contract(&client.address, || {
        env.storage().persistent().set(
            &storage::DataKey::Agreement(String::from_str(&env, agreement_id)),
            &agreement,
        );
    });

    // Set ledger timestamp to after end_date to simulate expiration
    env.ledger().with_mut(|li| li.timestamp = 300);

    // Try to sign expired agreement
    client.sign_agreement(&tenant, &String::from_str(&env, agreement_id));
}

#[test]
#[should_panic(expected = "Error(Contract, #15)")]
fn test_sign_agreement_already_signed() {
    let env = Env::default();
    env.mock_all_auths();

    let client = create_contract(&env);
    let tenant = Address::generate(&env);
    let landlord = Address::generate(&env);

    let agreement_id = "SIGN_005";
    create_pending_agreement(&env, &client, agreement_id, &tenant, &landlord);

    // First signing should succeed
    client.sign_agreement(&tenant, &String::from_str(&env, agreement_id));

    // Try to sign again (should fail with InvalidState)
    client.sign_agreement(&tenant, &String::from_str(&env, agreement_id));
}

#[test]
fn test_sign_agreement_event_emission() {
    let env = Env::default();
    env.mock_all_auths();

    let client = create_contract(&env);
    let tenant = Address::generate(&env);
    let landlord = Address::generate(&env);

    let agreement_id = "SIGN_006";
    create_pending_agreement(&env, &client, agreement_id, &tenant, &landlord);

    // Clear previous events
    let events_before = env.events().all().len();

    // Sign the agreement
    client.sign_agreement(&tenant, &String::from_str(&env, agreement_id));

    // Verify new event was emitted
    let events_after = env.events().all();
    assert!(events_after.len() > events_before);
}

#[test]
fn test_get_agreement() {
    let env = Env::default();
    env.mock_all_auths();

    let client = create_contract(&env);
    let tenant = Address::generate(&env);
    let landlord = Address::generate(&env);

    let agreement_id = String::from_str(&env, "GET_001");

    client.create_agreement(
        &agreement_id,
        &landlord,
        &tenant,
        &None,
        &1000,
        &2000,
        &100,
        &200,
        &0,
        &Address::generate(&env),
    );

    let agreement = client.get_agreement(&agreement_id).unwrap();
    assert_eq!(agreement.monthly_rent, 1000);
    assert_eq!(agreement.landlord, landlord);
    assert_eq!(agreement.tenant, tenant);
}

#[test]
fn test_has_agreement() {
    let env = Env::default();
    env.mock_all_auths();

    let client = create_contract(&env);
    let tenant = Address::generate(&env);
    let landlord = Address::generate(&env);

    let agreement_id = String::from_str(&env, "HAS_001");

    assert!(!client.has_agreement(&agreement_id));

    client.create_agreement(
        &agreement_id,
        &landlord,
        &tenant,
        &None,
        &1000,
        &2000,
        &100,
        &200,
        &0,
        &Address::generate(&env),
    );

    assert!(client.has_agreement(&agreement_id));
}

#[test]
fn test_get_agreement_count() {
    let env = Env::default();
    env.mock_all_auths();

    let client = create_contract(&env);
    let tenant = Address::generate(&env);
    let landlord = Address::generate(&env);

    assert_eq!(client.get_agreement_count(), 0);

    client.create_agreement(
        &String::from_str(&env, "COUNT_001"),
        &landlord,
        &tenant,
        &None,
        &1000,
        &2000,
        &100,
        &200,
        &0,
        &Address::generate(&env),
    );

    assert_eq!(client.get_agreement_count(), 1);

    client.create_agreement(
        &String::from_str(&env, "COUNT_002"),
        &landlord,
        &tenant,
        &None,
        &1000,
        &2000,
        &100,
        &200,
        &0,
        &Address::generate(&env),
    );

    assert_eq!(client.get_agreement_count(), 2);
}
