use soroban_sdk::{contractevent, Address, Env, String};

/// Event emitted when the contract is initialized
/// Topics: ["initialized", admin: Address]
#[contractevent(topics = ["initialized"])]
pub struct ContractInitialized {
    #[topic]
    pub admin: Address,
}

/// Event emitted when a property is registered
/// Topics: ["prop_reg", landlord: Address, property_id: String]
#[contractevent(topics = ["prop_reg"])]
pub struct PropertyRegistered {
    #[topic]
    pub landlord: Address,
    #[topic]
    pub property_id: String,
    pub metadata_hash: String,
}

/// Event emitted when a property is listed for discovery.
/// Topics: ["prop_listed", landlord: Address, property_id: String]
/// `visibility` is the discovery discriminator consumed by the backend indexer
/// (`listed` | `unlisted` | `draft` | `rented`).
#[contractevent(topics = ["prop_listed"])]
pub struct PropertyListed {
    #[topic]
    pub landlord: Address,
    #[topic]
    pub property_id: String,
    pub visibility: String,
}

/// Event emitted when a property is withdrawn from discovery.
/// Topics: ["prop_unlisted", landlord: Address, property_id: String]
#[contractevent(topics = ["prop_unlisted"])]
pub struct PropertyUnlisted {
    #[topic]
    pub landlord: Address,
    #[topic]
    pub property_id: String,
    pub visibility: String,
}

/// Event emitted when a property is verified
/// Topics: ["prop_ver", admin: Address, property_id: String]
#[contractevent(topics = ["prop_ver"])]
pub struct PropertyVerified {
    #[topic]
    pub admin: Address,
    #[topic]
    pub property_id: String,
}

/// Event emitted when contract is paused
#[contractevent(topics = ["paused"])]
pub struct Paused {
    pub reason: String,
    pub paused_by: Address,
}

/// Event emitted when contract is unpaused
#[contractevent(topics = ["unpaused"])]
pub struct Unpaused {
    pub unpaused_by: Address,
}

/// Event emitted when admin transfer is proposed
#[contractevent(topics = ["admin_proposed"])]
pub struct AdminProposed {
    pub current_admin: Address,
    pub pending_admin: Address,
}

/// Event emitted when admin transfer is accepted
#[contractevent(topics = ["admin_transferred"])]
pub struct AdminTransferred {
    pub old_admin: Address,
    pub new_admin: Address,
}

/// Helper function to emit contract initialized event
pub(crate) fn contract_initialized(env: &Env, admin: Address) {
    ContractInitialized { admin }.publish(env);
}

/// Helper function to emit property registered event
pub(crate) fn property_registered(
    env: &Env,
    property_id: String,
    landlord: Address,
    metadata_hash: String,
) {
    PropertyRegistered {
        landlord,
        property_id,
        metadata_hash,
    }
    .publish(env);
}

/// Helper function to emit property listed event (visibility discriminator for indexer)
pub(crate) fn property_listed(
    env: &Env,
    property_id: String,
    landlord: Address,
    visibility: String,
) {
    PropertyListed {
        landlord,
        property_id,
        visibility,
    }
    .publish(env);
}

/// Helper function to emit property unlisted event
pub(crate) fn property_unlisted(
    env: &Env,
    property_id: String,
    landlord: Address,
    visibility: String,
) {
    PropertyUnlisted {
        landlord,
        property_id,
        visibility,
    }
    .publish(env);
}

/// Helper function to emit property verified event
pub(crate) fn property_verified(env: &Env, property_id: String, admin: Address) {
    PropertyVerified { admin, property_id }.publish(env);
}

/// Helper function to emit paused event
pub(crate) fn paused(env: &Env, reason: String, paused_by: Address) {
    Paused { reason, paused_by }.publish(env);
}

/// Helper function to emit unpaused event
pub(crate) fn unpaused(env: &Env, unpaused_by: Address) {
    Unpaused { unpaused_by }.publish(env);
}

/// Helper function to emit admin proposed event
pub(crate) fn admin_proposed(env: &Env, current_admin: Address, pending_admin: Address) {
    AdminProposed {
        current_admin,
        pending_admin,
    }
    .publish(env);
}

/// Helper function to emit admin transferred event
pub(crate) fn admin_transferred(env: &Env, old_admin: Address, new_admin: Address) {
    AdminTransferred {
        old_admin,
        new_admin,
    }
    .publish(env);
}
