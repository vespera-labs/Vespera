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
    pub amount: i128,
}

#[contractevent(topics = ["escrow_released"])]
pub struct EscrowReleased {
    #[topic]
    pub escrow_id: BytesN<32>,
    pub amount: i128,
    pub recipient: Address,
}

#[contractevent(topics = ["escrow_refunded"])]
pub struct EscrowRefunded {
    #[topic]
    pub escrow_id: BytesN<32>,
    pub amount: i128,
    pub recipient: Address,
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

pub(crate) fn escrow_funded(env: &Env, escrow_id: BytesN<32>, amount: i128) {
    EscrowFunded { escrow_id, amount }.publish(env);
}

pub(crate) fn escrow_released(env: &Env, escrow_id: BytesN<32>, amount: i128, recipient: Address) {
    EscrowReleased {
        escrow_id,
        amount,
        recipient,
    }
    .publish(env);
}

pub(crate) fn escrow_refunded(env: &Env, escrow_id: BytesN<32>, amount: i128, recipient: Address) {
    EscrowRefunded {
        escrow_id,
        amount,
        recipient,
    }
    .publish(env);
}
