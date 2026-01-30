//! Tests for the Payment contract.

use crate::payment_impl::*;
use crate::types::*;
use soroban_sdk::token::StellarAssetClient as TokenAdminClient;
use soroban_sdk::{testutils::Address as _, Address, Env, Map, String};

// Helper function to create a test agreement
fn create_test_agreement(
    env: &Env,
    id: &str,
    tenant: &Address,
    landlord: &Address,
    agent: Option<Address>,
    monthly_rent: i128,
    commission_rate: u32,
    status: AgreementStatus,
    payment_token: Address,
) -> RentAgreement {
    RentAgreement {
        agreement_id: String::from_str(env, id),
        tenant: tenant.clone(),
        landlord: landlord.clone(),
        agent,
        monthly_rent,
        agent_commission_rate: commission_rate,
        status,
        total_rent_paid: 0,
        payment_count: 0,
        security_deposit: 0,
        start_date: 0,
        end_date: 0,
        signed_at: None,
        payment_token,
        next_payment_due: 0,
        payment_history: Map::new(env),
    }
}

fn create_token(env: &Env, admin: &Address) -> Address {
    env.register_stellar_asset_contract_v2(admin.clone())
        .address()
}

#[test]
fn test_calculate_payment_split_no_commission() {
    let (landlord, agent) = calculate_payment_split(&1000, &0);
    assert_eq!(landlord, 1000);
    assert_eq!(agent, 0);
}

#[test]
fn test_calculate_payment_split_5_percent() {
    // Test with 5% commission (500 basis points)
    let (landlord, agent) = calculate_payment_split(&1000, &500);
    assert_eq!(landlord, 950);
    assert_eq!(agent, 50);
}

#[test]
fn test_calculate_payment_split_10_percent() {
    // Test with 10% commission (1000 basis points)
    let (landlord, agent) = calculate_payment_split(&2000, &1000);
    assert_eq!(landlord, 1800);
    assert_eq!(agent, 200);
}

#[test]
fn test_calculate_payment_split_2_5_percent() {
    // Test with 2.5% commission (250 basis points)
    let (landlord, agent) = calculate_payment_split(&10000, &250);
    assert_eq!(landlord, 9750);
    assert_eq!(agent, 250);
}

#[test]
fn test_create_payment_record() {
    let env = Env::default();
    let tenant = Address::generate(&env);
    let agreement_id = String::from_str(&env, "AGR_001");

    let record =
        create_payment_record(&env, &agreement_id, 1000, 950, 50, &tenant, 1, 12345).unwrap();

    assert_eq!(record.agreement_id, agreement_id);
    assert_eq!(record.amount, 1000);
    assert_eq!(record.landlord_amount, 950);
    assert_eq!(record.agent_amount, 50);
    assert_eq!(record.payment_number, 1);
    assert_eq!(record.timestamp, 12345);
    assert_eq!(record.tenant, tenant);
}

#[test]
fn test_create_test_agreement() {
    let env = Env::default();
    let tenant = Address::generate(&env);
    let landlord = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let token = create_token(&env, &token_admin);

    let agreement = create_test_agreement(
        &env,
        "agreement_1",
        &tenant,
        &landlord,
        None,
        1000,
        0,
        AgreementStatus::Active,
        token.clone(),
    );

    assert_eq!(agreement.monthly_rent, 1000);
    assert_eq!(agreement.status, AgreementStatus::Active);
    assert_eq!(agreement.tenant, tenant);
    assert_eq!(agreement.landlord, landlord);
}

#[test]
fn test_agreement_with_agent() {
    let env = Env::default();
    env.mock_all_auths();

    let tenant = Address::generate(&env);
    let landlord = Address::generate(&env);
    let agent = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let token = create_token(&env, &token_admin);

    // Mint tokens to tenant
    TokenAdminClient::new(&env, &token).mint(&tenant, &100000);

    let agreement = create_test_agreement(
        &env,
        "agreement_2",
        &tenant,
        &landlord,
        Some(agent.clone()),
        1000,
        500, // 5% commission
        AgreementStatus::Active,
        token.clone(),
    );

    assert_eq!(agreement.agent, Some(agent));
    assert_eq!(agreement.agent_commission_rate, 500);
}
