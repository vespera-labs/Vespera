use soroban_sdk::{contracttype, String};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DataKey {
    Agreement(String),
    AgreementCount,
    State,
    PauseState,
    Initialized,
    SupportedToken(soroban_sdk::Address),
    SupportedTokens,
    ExchangeRate(soroban_sdk::Address, soroban_sdk::Address),
    AgreementToken(String),
    DepositInterestConfig(String),
    DepositInterest(String),
    /// Per-escrow pool of funds actually reserved to pay this deposit's
    /// interest. `distribute_interest` may only pay out of this balance, so
    /// one escrow's interest can never be drawn from another's pooled rent
    /// or deposit funds.
    InterestReserve(String),
    ErrorLog(u32),
    ErrorLogCount,
    RoyaltyConfig(String),
    RoyaltyPayments(String),
    RateLimitConfig,
    UserCallCount(soroban_sdk::Address, String), // (user, function_name)
    BlockCallCount(u64, String),                 // (block_number, function_name)
    PaymentRecord(String, u32),
    /// Per-agreement, per-token escrowed balance. The on-chain
    /// transfer pools all agreements into the contract address, so the
    /// contract has to do its own accounting to release only what each
    /// agreement deposited.
    AgreementEscrowBalance(String, soroban_sdk::Address),
    // Multi-sig keys
    MultiSigConfig,
    AdminProposal(String),
    ProposalCount,
    ActiveProposals,
    // Timelock keys
    TimelockAction(String),
    TimelockActionCount,
    ActiveTimelockActions,
    // Versioning keys
    CurrentVersion,
    VersionHistory,
}
