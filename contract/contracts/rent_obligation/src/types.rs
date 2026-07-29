use soroban_sdk::{contracttype, Address, Bytes, String};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RentObligation {
    pub agreement_id: String,
    pub owner: Address,
    pub minted_at: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct BurnRecord {
    pub token_id: String,
    pub burned_by: Address,
    pub burned_at: u64,
    pub reason: String,
}

// ─── Cross-contract types (must match user_profile contract) ─────────────────

/// KYC verification status — mirrors user_profile::KycStatus
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum KycStatus {
    Unverified = 0,
    Pending = 1,
    Verified = 2,
    Rejected = 3,
}

/// Screening status — mirrors user_profile::ScreeningStatus
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum ScreeningStatus {
    Clear = 0,
    Flagged = 1,
    Blocked = 2,
}

/// Account type — mirrors user_profile::AccountType
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum AccountType {
    Tenant = 0,
    Landlord = 1,
    Agent = 2,
}

/// User profile — mirrors user_profile::UserProfile for cross-contract deserialization
#[contracttype]
#[derive(Clone, Debug)]
pub struct UserProfile {
    pub account_id: Address,
    pub version: String,
    pub account_type: AccountType,
    pub last_updated: u64,
    pub data_hash: Bytes,
    pub is_verified: bool,
    pub kyc_status: KycStatus,
    pub screening_status: ScreeningStatus,
}
