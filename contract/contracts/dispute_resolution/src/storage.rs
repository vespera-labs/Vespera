use soroban_sdk::{contracttype, Address, String};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DataKey {
    Arbiter(Address),
    ArbiterList,
    State,
    Initialized,
    ArbiterCount,
    Dispute(String),
    Vote(String, Address),
    Appeal(String),
    AppealForDispute(String),
    AppealCount,
    AppealFeePaid(String),
    AppealFeeRefunded(String),
    TimeoutConfig,
    // Weighted voting
    ArbiterStats(Address),
    WeightedVote(String, Address),
    WeightedDisputeVotes(String),
    // Rate limiting
    RateLimitConfig,
    UserCallCount(Address, String),
    BlockCallCount(u64, String),
    // Admin and Pause
    PauseState,
    PendingAdmin,
}

/// Ledger-count threshold below which an instance or persistent entry is bumped.
///
/// Shared across the `dispute_resolution` contract and aligned with the
/// workspace-wide 500_000-ledger TTL policy used by the other contracts, so that
/// the admin/`State` entry and every per-record entry are extended with one
/// consistent lifetime. Sized to comfortably outlive the longest dispute window
/// (the 30-day default dispute timeout).
pub const TTL_THRESHOLD: u32 = 500_000;
/// Number of ledgers an entry's life is extended to when bumped.
pub const TTL_BUMP: u32 = 500_000;
