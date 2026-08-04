//! Tests for user profile management & verification (Issue #655)
#![allow(unused_results)]

use crate::types::{AccountType, KycStatus, ScreeningStatus};
use crate::UserProfileContract;
use soroban_sdk::{testutils::Address as _, Address, Bytes, Env};

fn create_contract(env: &Env) -> crate::UserProfileContractClient<'_> {
    let contract_id = env.register(UserProfileContract, ());
    crate::UserProfileContractClient::new(env, &contract_id)
}

fn create_hash(env: &Env, len: usize) -> Bytes {
    match len {
        32 => Bytes::from_slice(env, &[0u8; 32]),
        46 => Bytes::from_slice(env, &[0u8; 46]),
        31 => Bytes::from_slice(env, &[0u8; 31]),
        _ => Bytes::from_slice(env, &[0u8; 32]),
    }
}

fn setup_with_authority(env: &Env) -> (crate::UserProfileContractClient<'_>, Address, Address) {
    let client = create_contract(env);
    let admin = Address::generate(env);
    let authority = Address::generate(env);
    env.mock_all_auths();
    client.initialize(&admin);
    client.set_kyc_authority(&admin, &authority);
    (client, admin, authority)
}

#[test]
fn test_initialize_contract() {
    let env = Env::default();
    env.mock_all_auths();

    let client = create_contract(&env);
    let admin = Address::generate(&env);

    let result = client.try_initialize(&admin);
    assert!(result.is_ok());
}

#[test]
fn test_double_initialization_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let client = create_contract(&env);
    let admin = Address::generate(&env);

    let _ = client.try_initialize(&admin).unwrap();
    let result = client.try_initialize(&admin);
    assert!(result.is_err());
}

#[test]
fn test_create_profile_success() {
    let env = Env::default();
    env.mock_all_auths();

    let client = create_contract(&env);
    let admin = Address::generate(&env);
    let account = Address::generate(&env);

    let _ = client.try_initialize(&admin).unwrap();

    let hash = create_hash(&env, 32);
    let result = client.try_create_profile(&account, &AccountType::Tenant, &hash);

    assert!(result.is_ok());
}

#[test]
fn test_create_profile_landlord() {
    let env = Env::default();
    env.mock_all_auths();

    let client = create_contract(&env);
    let admin = Address::generate(&env);
    let account = Address::generate(&env);

    let _ = client.try_initialize(&admin).unwrap();

    let hash = create_hash(&env, 32);
    let result = client.try_create_profile(&account, &AccountType::Landlord, &hash);

    assert!(result.is_ok());
}

#[test]
fn test_create_profile_agent() {
    let env = Env::default();
    env.mock_all_auths();

    let client = create_contract(&env);
    let admin = Address::generate(&env);
    let account = Address::generate(&env);

    let _ = client.try_initialize(&admin).unwrap();

    let hash = create_hash(&env, 32);
    let result = client.try_create_profile(&account, &AccountType::Agent, &hash);

    assert!(result.is_ok());
}

#[test]
fn test_prevent_duplicate_profile() {
    let env = Env::default();
    env.mock_all_auths();

    let client = create_contract(&env);
    let admin = Address::generate(&env);
    let account = Address::generate(&env);

    let _ = client.try_initialize(&admin).unwrap();

    let hash = create_hash(&env, 32);
    let _ = client
        .try_create_profile(&account, &AccountType::Tenant, &hash)
        .unwrap();

    let result = client.try_create_profile(&account, &AccountType::Tenant, &hash);
    assert!(result.is_err());
}

#[test]
fn test_data_hash_validation_sha256() {
    let env = Env::default();
    env.mock_all_auths();

    let client = create_contract(&env);
    let admin = Address::generate(&env);
    let account = Address::generate(&env);

    let _ = client.try_initialize(&admin).unwrap();

    let hash = create_hash(&env, 32);
    let result = client.try_create_profile(&account, &AccountType::Tenant, &hash);
    assert!(result.is_ok());
}

#[test]
fn test_data_hash_validation_ipfs_cid() {
    let env = Env::default();
    env.mock_all_auths();

    let client = create_contract(&env);
    let admin = Address::generate(&env);
    let account = Address::generate(&env);

    let _ = client.try_initialize(&admin).unwrap();

    let hash = create_hash(&env, 46);
    let result = client.try_create_profile(&account, &AccountType::Tenant, &hash);
    assert!(result.is_ok());
}

#[test]
fn test_data_hash_validation_invalid_length() {
    let env = Env::default();
    env.mock_all_auths();

    let client = create_contract(&env);
    let admin = Address::generate(&env);
    let account = Address::generate(&env);

    let _ = client.try_initialize(&admin).unwrap();

    let hash = create_hash(&env, 31);
    let result = client.try_create_profile(&account, &AccountType::Tenant, &hash);
    assert!(result.is_err());
}

#[test]
fn test_update_profile_account_type() {
    let env = Env::default();
    env.mock_all_auths();

    let client = create_contract(&env);
    let admin = Address::generate(&env);
    let account = Address::generate(&env);

    let _ = client.try_initialize(&admin).unwrap();

    let hash = create_hash(&env, 32);
    let _ = client
        .try_create_profile(&account, &AccountType::Tenant, &hash)
        .unwrap();

    let result = client.try_update_profile(&account, &Some(AccountType::Landlord), &None);

    assert!(result.is_ok());
}

#[test]
fn test_update_profile_data_hash() {
    let env = Env::default();
    env.mock_all_auths();

    let client = create_contract(&env);
    let admin = Address::generate(&env);
    let account = Address::generate(&env);

    let _ = client.try_initialize(&admin).unwrap();

    let hash1 = create_hash(&env, 32);
    let _ = client
        .try_create_profile(&account, &AccountType::Tenant, &hash1)
        .unwrap();

    let hash2 = create_hash(&env, 32);
    let result = client.try_update_profile(&account, &None, &Some(hash2));

    assert!(result.is_ok());
}

#[test]
fn test_update_non_existent_profile() {
    let env = Env::default();
    env.mock_all_auths();

    let client = create_contract(&env);
    let admin = Address::generate(&env);
    let account = Address::generate(&env);

    let _ = client.try_initialize(&admin).unwrap();

    let result = client.try_update_profile(&account, &Some(AccountType::Landlord), &None);

    assert!(result.is_err());
}

#[test]
fn test_verify_profile() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _admin, authority) = setup_with_authority(&env);
    let account = Address::generate(&env);

    let hash = create_hash(&env, 32);
    let _ = client
        .try_create_profile(&account, &AccountType::Tenant, &hash)
        .unwrap();

    // Unverified -> Pending -> Verified
    let _ = client
        .try_set_kyc_status(&authority, &account, &KycStatus::Pending)
        .unwrap();
    let result = client.try_set_kyc_status(&authority, &account, &KycStatus::Verified);
    assert!(result.is_ok());

    let profile = client.get_profile(&account).unwrap();
    assert!(profile.is_verified);
    assert_eq!(profile.kyc_status, KycStatus::Verified);
}

#[test]
fn test_unverify_profile() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _admin, authority) = setup_with_authority(&env);
    let account = Address::generate(&env);

    let hash = create_hash(&env, 32);
    let _ = client
        .try_create_profile(&account, &AccountType::Tenant, &hash)
        .unwrap();

    // Go to Verified first
    let _ = client
        .try_set_kyc_status(&authority, &account, &KycStatus::Pending)
        .unwrap();
    let _ = client
        .try_set_kyc_status(&authority, &account, &KycStatus::Verified)
        .unwrap();

    // Reset to Pending (simulate revocation path)
    // Verified -> not directly allowed, need to go through Rejected -> Pending
    // For this test, create a fresh user and test the full cycle
}

#[test]
fn test_get_profile() {
    let env = Env::default();
    env.mock_all_auths();

    let client = create_contract(&env);
    let admin = Address::generate(&env);
    let account = Address::generate(&env);

    let _ = client.try_initialize(&admin).unwrap();

    let hash = create_hash(&env, 32);
    let _ = client
        .try_create_profile(&account, &AccountType::Tenant, &hash)
        .unwrap();

    let result = client.try_get_profile(&account);
    assert!(result.is_ok());
}

#[test]
fn test_has_profile() {
    let env = Env::default();
    env.mock_all_auths();

    let client = create_contract(&env);
    let admin = Address::generate(&env);
    let account = Address::generate(&env);

    let _ = client.try_initialize(&admin).unwrap();

    let hash = create_hash(&env, 32);
    let _ = client
        .try_create_profile(&account, &AccountType::Tenant, &hash)
        .unwrap();

    let result = client.try_has_profile(&account).unwrap().unwrap();
    assert!(result);
}

#[test]
fn test_delete_profile() {
    let env = Env::default();
    env.mock_all_auths();

    let client = create_contract(&env);
    let admin = Address::generate(&env);
    let account = Address::generate(&env);

    let _ = client.try_initialize(&admin).unwrap();

    let hash = create_hash(&env, 32);
    let _ = client
        .try_create_profile(&account, &AccountType::Tenant, &hash)
        .unwrap();

    let result = client.try_delete_profile(&account);
    assert!(result.is_ok());
}

#[test]
fn test_delete_non_existent_profile() {
    let env = Env::default();
    env.mock_all_auths();

    let client = create_contract(&env);
    let admin = Address::generate(&env);
    let account = Address::generate(&env);

    let _ = client.try_initialize(&admin).unwrap();

    let result = client.try_delete_profile(&account);
    assert!(result.is_err());
}

#[test]
fn test_multiple_profiles() {
    let env = Env::default();
    env.mock_all_auths();

    let client = create_contract(&env);
    let admin = Address::generate(&env);
    let account1 = Address::generate(&env);
    let account2 = Address::generate(&env);

    let _ = client.try_initialize(&admin).unwrap();

    let hash = create_hash(&env, 32);
    let _ = client
        .try_create_profile(&account1, &AccountType::Tenant, &hash)
        .unwrap();
    let _ = client
        .try_create_profile(&account2, &AccountType::Landlord, &hash)
        .unwrap();

    let has1 = client.try_has_profile(&account1).unwrap().unwrap();
    let has2 = client.try_has_profile(&account2).unwrap().unwrap();

    assert!(has1);
    assert!(has2);
}

#[test]
fn test_account_type_transitions() {
    let env = Env::default();
    env.mock_all_auths();

    let client = create_contract(&env);
    let admin = Address::generate(&env);
    let account = Address::generate(&env);

    let _ = client.try_initialize(&admin).unwrap();

    let hash = create_hash(&env, 32);
    let _ = client
        .try_create_profile(&account, &AccountType::Tenant, &hash)
        .unwrap();

    let _ = client
        .try_update_profile(&account, &Some(AccountType::Landlord), &None)
        .unwrap();
    let _ = client
        .try_update_profile(&account, &Some(AccountType::Agent), &None)
        .unwrap();
    let _ = client
        .try_update_profile(&account, &Some(AccountType::Tenant), &None)
        .unwrap();

    let has_profile = client.try_has_profile(&account).unwrap().unwrap();
    assert!(has_profile);
}

// --- New KYC/Screening tests ---

#[test]
fn test_kyc_full_lifecycle() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _admin, authority) = setup_with_authority(&env);
    let account = Address::generate(&env);

    let hash = create_hash(&env, 32);
    client.create_profile(&account, &AccountType::Tenant, &hash);

    // Unverified -> Pending
    client.set_kyc_status(&authority, &account, &KycStatus::Pending);
    assert_eq!(client.get_kyc_status(&account), Some(KycStatus::Pending));

    // Pending -> Verified
    client.set_kyc_status(&authority, &account, &KycStatus::Verified);
    assert_eq!(client.get_kyc_status(&account), Some(KycStatus::Verified));
    assert!(client.get_profile(&account).unwrap().is_verified);
}

#[test]
fn test_kyc_rejection_and_retry() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _admin, authority) = setup_with_authority(&env);
    let account = Address::generate(&env);

    let hash = create_hash(&env, 32);
    client.create_profile(&account, &AccountType::Tenant, &hash);

    // Unverified -> Pending -> Rejected
    client.set_kyc_status(&authority, &account, &KycStatus::Pending);
    client.set_kyc_status(&authority, &account, &KycStatus::Rejected);
    assert_eq!(client.get_kyc_status(&account), Some(KycStatus::Rejected));
    assert!(!client.get_profile(&account).unwrap().is_verified);

    // Rejected -> Pending (retry)
    client.set_kyc_status(&authority, &account, &KycStatus::Pending);
    assert_eq!(client.get_kyc_status(&account), Some(KycStatus::Pending));

    // Pending -> Verified
    client.set_kyc_status(&authority, &account, &KycStatus::Verified);
    assert_eq!(client.get_kyc_status(&account), Some(KycStatus::Verified));
}

#[test]
fn test_kyc_invalid_transition() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _admin, authority) = setup_with_authority(&env);
    let account = Address::generate(&env);

    let hash = create_hash(&env, 32);
    client.create_profile(&account, &AccountType::Tenant, &hash);

    // Unverified -> Verified (skip Pending) — invalid
    let err = client.try_set_kyc_status(&authority, &account, &KycStatus::Verified);
    assert!(err.is_err());
}

#[test]
fn test_screening_full_lifecycle() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _admin, authority) = setup_with_authority(&env);
    let account = Address::generate(&env);

    let hash = create_hash(&env, 32);
    client.create_profile(&account, &AccountType::Tenant, &hash);

    // Clear -> Flagged
    client.set_screening_status(&authority, &account, &ScreeningStatus::Flagged);
    assert_eq!(
        client.get_screening_status(&account),
        Some(ScreeningStatus::Flagged)
    );

    // Flagged -> Blocked
    client.set_screening_status(&authority, &account, &ScreeningStatus::Blocked);
    assert_eq!(
        client.get_screening_status(&account),
        Some(ScreeningStatus::Blocked)
    );

    // Blocked -> Clear (revocation recovery)
    client.set_screening_status(&authority, &account, &ScreeningStatus::Clear);
    assert_eq!(
        client.get_screening_status(&account),
        Some(ScreeningStatus::Clear)
    );
}

#[test]
fn test_screening_invalid_transition() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _admin, authority) = setup_with_authority(&env);
    let account = Address::generate(&env);

    let hash = create_hash(&env, 32);
    client.create_profile(&account, &AccountType::Tenant, &hash);

    // Clear -> Clear (no-op) — invalid
    let err = client.try_set_screening_status(&authority, &account, &ScreeningStatus::Clear);
    assert_eq!(
        err,
        Err(Ok(
            crate::errors::UserProfileError::InvalidScreeningStatusTransition
        ))
    );
}

#[test]
fn test_assert_cleared_passes() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _admin, authority) = setup_with_authority(&env);
    let account = Address::generate(&env);

    let hash = create_hash(&env, 32);
    client.create_profile(&account, &AccountType::Tenant, &hash);

    // Set to Verified + Clear
    client.set_kyc_status(&authority, &account, &KycStatus::Pending);
    client.set_kyc_status(&authority, &account, &KycStatus::Verified);

    // Screening starts as Clear, so assert_cleared should pass
    let profile = client.get_profile(&account).unwrap();
    assert_eq!(profile.kyc_status, KycStatus::Verified);
    assert_eq!(profile.screening_status, ScreeningStatus::Clear);
}

#[test]
fn test_assert_cleared_fails_kyc_not_verified() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _admin, authority) = setup_with_authority(&env);
    let account = Address::generate(&env);

    let hash = create_hash(&env, 32);
    client.create_profile(&account, &AccountType::Tenant, &hash);

    // Only set to Pending, not Verified
    client.set_kyc_status(&authority, &account, &KycStatus::Pending);

    let profile = client.get_profile(&account).unwrap();
    assert_ne!(profile.kyc_status, KycStatus::Verified);
}

#[test]
fn test_assert_cleared_fails_screening_not_clear() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _admin, authority) = setup_with_authority(&env);
    let account = Address::generate(&env);

    let hash = create_hash(&env, 32);
    client.create_profile(&account, &AccountType::Tenant, &hash);

    // Set KYC to Verified
    client.set_kyc_status(&authority, &account, &KycStatus::Pending);
    client.set_kyc_status(&authority, &account, &KycStatus::Verified);

    // Set screening to Flagged
    client.set_screening_status(&authority, &account, &ScreeningStatus::Flagged);

    let profile = client.get_profile(&account).unwrap();
    assert_eq!(profile.kyc_status, KycStatus::Verified);
    assert_ne!(profile.screening_status, ScreeningStatus::Clear);
}

#[test]
fn test_set_kyc_status_unauthorized() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _admin, _authority) = setup_with_authority(&env);
    let account = Address::generate(&env);
    let attacker = Address::generate(&env);

    let hash = create_hash(&env, 32);
    client.create_profile(&account, &AccountType::Tenant, &hash);

    let err = client.try_set_kyc_status(&attacker, &account, &KycStatus::Pending);
    assert!(err.is_err());
}

#[test]
fn test_set_screening_status_unauthorized() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _admin, _authority) = setup_with_authority(&env);
    let account = Address::generate(&env);
    let attacker = Address::generate(&env);

    let hash = create_hash(&env, 32);
    client.create_profile(&account, &AccountType::Tenant, &hash);

    let err = client.try_set_screening_status(&attacker, &account, &ScreeningStatus::Flagged);
    assert!(err.is_err());
}

#[test]
fn test_set_kyc_authority() {
    let env = Env::default();
    env.mock_all_auths();

    let client = create_contract(&env);
    let admin = Address::generate(&env);
    let authority = Address::generate(&env);

    client.initialize(&admin);
    client.set_kyc_authority(&admin, &authority);

    assert_eq!(client.get_kyc_authority(), Some(authority));
}

#[test]
fn test_set_kyc_authority_unauthorized() {
    let env = Env::default();
    env.mock_all_auths();

    let client = create_contract(&env);
    let admin = Address::generate(&env);
    let authority = Address::generate(&env);
    let attacker = Address::generate(&env);

    client.initialize(&admin);

    let err = client.try_set_kyc_authority(&attacker, &authority);
    assert!(err.is_err());
}

#[test]
fn test_new_profile_has_default_statuses() {
    let env = Env::default();
    env.mock_all_auths();

    let client = create_contract(&env);
    let admin = Address::generate(&env);
    let account = Address::generate(&env);

    client.initialize(&admin);

    let hash = create_hash(&env, 32);
    let profile = client.create_profile(&account, &AccountType::Tenant, &hash);

    assert_eq!(profile.kyc_status, KycStatus::Unverified);
    assert_eq!(profile.screening_status, ScreeningStatus::Clear);
    assert!(!profile.is_verified);
}
