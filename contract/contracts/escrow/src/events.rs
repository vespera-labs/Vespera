//! Contract events for escrow lifecycle and timeout handling.
use soroban_sdk::{contractevent, Address, BytesN, Env};

#[contractevent(topics = ["escrow_timeout"])]
pub struct EscrowTimeout {
    #[topic]
    pub escrow_id: BytesN<32>,
}

#[contractevent(topics = ["dispute_timeout"])]
pub struct DisputeTimeout {
    #[topic]
    pub escrow_id: BytesN<32>,
}

#[contractevent(topics = ["partial_release"])]
pub struct PartialRelease {
    #[topic]
    pub escrow_id: BytesN<32>,
    pub amount: i128,
    pub recipient: Address,
}

#[contractevent(topics = ["damage_deduction"])]
pub struct DamageDeduction {
    #[topic]
    pub escrow_id: BytesN<32>,
    pub damage_amount: i128,
    pub refund_amount: i128,
}

#[contractevent(topics = ["escrow_funded"])]
pub struct EscrowFunded {
    #[topic]
    pub escrow_id: BytesN<32>,
    pub depositor: Address,
    pub amount: i128,
}

#[contractevent(topics = ["escrow_released"])]
pub struct EscrowReleased {
    #[topic]
    pub escrow_id: BytesN<32>,
    pub recipient: Address,
    pub amount: i128,
}

/// Emitted when an arbiter resolves a dispute. `refunded` distinguishes a
/// refund to the depositor (`true`) from a release to the beneficiary (`false`).
#[contractevent(topics = ["dispute_resolved"])]
pub struct DisputeResolved {
    #[topic]
    pub escrow_id: BytesN<32>,
    pub resolver: Address,
    pub recipient: Address,
    pub amount: i128,
    pub refunded: bool,
}

pub(crate) fn escrow_timeout(env: &Env, escrow_id: BytesN<32>) {
    EscrowTimeout { escrow_id }.publish(env);
}

pub(crate) fn dispute_timeout(env: &Env, escrow_id: BytesN<32>) {
    DisputeTimeout { escrow_id }.publish(env);
}

pub(crate) fn partial_release(env: &Env, escrow_id: BytesN<32>, amount: i128, recipient: Address) {
    PartialRelease {
        escrow_id,
        amount,
        recipient,
    }
    .publish(env);
}

pub(crate) fn damage_deduction(
    env: &Env,
    escrow_id: BytesN<32>,
    damage_amount: i128,
    refund_amount: i128,
) {
    DamageDeduction {
        escrow_id,
        damage_amount,
        refund_amount,
    }
    .publish(env);
}

pub(crate) fn escrow_funded(env: &Env, escrow_id: BytesN<32>, depositor: Address, amount: i128) {
    EscrowFunded {
        escrow_id,
        depositor,
        amount,
    }
    .publish(env);
}

pub(crate) fn escrow_released(env: &Env, escrow_id: BytesN<32>, recipient: Address, amount: i128) {
    EscrowReleased {
        escrow_id,
        recipient,
        amount,
    }
    .publish(env);
}

pub(crate) fn dispute_resolved(
    env: &Env,
    escrow_id: BytesN<32>,
    resolver: Address,
    recipient: Address,
    amount: i128,
    refunded: bool,
) {
    DisputeResolved {
        escrow_id,
        resolver,
        recipient,
        amount,
        refunded,
    }
    .publish(env);
}

use soroban_sdk::String;

#[contractevent(topics = ["initialized"])]
pub struct ContractInitialized {
    #[topic]
    pub admin: Address,
}

#[contractevent(topics = ["paused"])]
pub struct Paused {
    pub reason: String,
    pub paused_by: Address,
}

#[contractevent(topics = ["unpaused"])]
pub struct Unpaused {
    pub unpaused_by: Address,
}

#[contractevent(topics = ["admin_proposed"])]
pub struct AdminProposed {
    pub current_admin: Address,
    pub pending_admin: Address,
}

#[contractevent(topics = ["admin_transferred"])]
pub struct AdminTransferred {
    pub old_admin: Address,
    pub new_admin: Address,
}

pub(crate) fn contract_initialized(env: &Env, admin: Address) {
    ContractInitialized { admin }.publish(env);
}

pub(crate) fn paused(env: &Env, reason: String, paused_by: Address) {
    Paused { reason, paused_by }.publish(env);
}

pub(crate) fn unpaused(env: &Env, unpaused_by: Address) {
    Unpaused { unpaused_by }.publish(env);
}

pub(crate) fn admin_proposed(env: &Env, current_admin: Address, pending_admin: Address) {
    AdminProposed {
        current_admin,
        pending_admin,
    }
    .publish(env);
}

pub(crate) fn admin_transferred(env: &Env, old_admin: Address, new_admin: Address) {
    AdminTransferred {
        old_admin,
        new_admin,
    }
    .publish(env);
}
