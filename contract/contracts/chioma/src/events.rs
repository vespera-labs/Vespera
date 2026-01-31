use soroban_sdk::{contractevent, Address, Env, String};

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AgreementCreatedEvent {
    pub agreement_id: String,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AgreementSigned {
    pub agreement_id: String,
    pub landlord: Address,
    pub tenant: Address,
    pub signed_at: u64,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ContractInitialized {
    pub admin: Address,
}

pub(crate) fn contract_initialized(env: &Env, admin: Address) {
    ContractInitialized { admin }.publish(env);
}
