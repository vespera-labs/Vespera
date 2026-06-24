use soroban_sdk::{contracttype, Address, String};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DataKey {
    Agent(Address),
    State,
    Initialized,
    AgentCount,
    Transaction(String),
    /// Stores whether a rater has rated an agent (for duplicate prevention)
    AgentRating(Address, Address),
    /// Stores the list of all Rating structs for an agent (for auditability)
    AgentRatingList(Address),
}
