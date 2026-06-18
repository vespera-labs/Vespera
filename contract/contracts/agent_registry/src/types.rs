use soroban_sdk::{contracttype, Address, String, Vec};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AgentInfo {
    pub agent: Address,
    pub external_profile_hash: String,
    pub verified: bool,
    pub registered_at: u64,
    pub verified_at: Option<u64>,
    pub total_ratings: u32,
    pub total_score: u32,
    pub completed_agreements: u32,
}

impl AgentInfo {
    /// Returns the average rating scaled by 100 to avoid truncation.
    /// For example, a 4.5 average is returned as 450.
    /// Divide by 100 to get the whole number part, modulus 100 for the decimal.
    ///
    /// # Returns
    /// * `u32` - The average rating multiplied by 100, or 0 if no ratings exist
    pub fn average_rating(&self) -> u32 {
        if self.total_ratings == 0 {
            0
        } else {
            // Multiply by 100 first to preserve 2 decimal places of precision
            (self.total_score * 100) / self.total_ratings
        }
    }
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Rating {
    pub rater: Address,
    pub agent: Address,
    pub score: u32,
    pub rated_at: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ContractState {
    pub admin: Address,
    pub initialized: bool,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AgentTransaction {
    pub transaction_id: String,
    pub agent: Address,
    pub parties: Vec<Address>,
    pub completed: bool,
}
