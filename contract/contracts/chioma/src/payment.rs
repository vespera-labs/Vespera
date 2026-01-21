use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, String, Vec};
use soroban_sdk::token::Client as TokenClient;

// Error enum (add to existing errors)
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Error {
    // ... existing errors ...
    AgreementNotActive = 10,
    InvalidAmount = 11,
    PaymentFailed = 12,
}

// Payment record structure
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PaymentRecord {
    pub agreement_id: String,
    pub payment_number: u32,
    pub amount: i128,
    pub landlord_amount: i128,
    pub agent_amount: i128,
    pub timestamp: u64,
    pub tenant: Address,
}

// Agreement status enum (if not already defined)
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum AgreementStatus {
    Pending,
    Active,
    Completed,
    Cancelled,
}

// Agreement structure (assumed, adjust to match your actual structure)
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Agreement {
    pub id: String,
    pub tenant: Address,
    pub landlord: Address,
    pub agent: Option<Address>,
    pub monthly_rent: i128,
    pub commission_rate: u32, // in basis points (e.g., 500 = 5%)
    pub status: AgreementStatus,
    pub total_rent_paid: i128,
    pub payment_count: u32,
}

// Storage keys
#[contracttype]
pub enum DataKey {
    Agreement(String),
    PaymentRecord(String, u32), // (agreement_id, payment_number)
}

#[contract]
pub struct RentalContract;

#[contractimpl]
impl RentalContract {
    /// Process rent payment with automatic commission splitting
    pub fn pay_rent(
        env: Env,
        agreement_id: String,
        token: Address,
        amount: i128,
    ) -> Result<(), Error> {
        // Load agreement
        let mut agreement: Agreement = env
            .storage()
            .instance()
            .get(&DataKey::Agreement(agreement_id.clone()))
            .ok_or(Error::InvalidAmount)?;

        // Validate agreement is active
        if agreement.status != AgreementStatus::Active {
            return Err(Error::AgreementNotActive);
        }

        // Validate amount matches monthly rent exactly
        if amount != agreement.monthly_rent {
            return Err(Error::InvalidAmount);
        }

        // Authorize tenant
        agreement.tenant.require_auth();

        // Calculate payment split
        let (landlord_amount, agent_amount) = 
            calculate_payment_split(&amount, &agreement.commission_rate);

        // Execute atomic token transfers
        let token_client = TokenClient::new(&env, &token);
        
        // Transfer to landlord
        token_client.transfer(
            &agreement.tenant,
            &agreement.landlord,
            &landlord_amount,
        );

        // Transfer to agent if present
        if let Some(agent_address) = &agreement.agent {
            if agent_amount > 0 {
                token_client.transfer(
                    &agreement.tenant,
                    agent_address,
                    &agent_amount,
                );
            }
        }

        // Create payment record
        let timestamp = env.ledger().timestamp();
        let payment_record = create_payment_record(
            &env,
            &agreement_id,
            amount,
            landlord_amount,
            agent_amount,
            &agreement.tenant,
            agreement.payment_count + 1,
            timestamp,
        )?;

        // Update agreement totals
        agreement.total_rent_paid += amount;
        agreement.payment_count += 1;

        // Persist updated agreement
        env.storage()
            .instance()
            .set(&DataKey::Agreement(agreement_id.clone()), &agreement);

        // Persist payment record
        env.storage()
            .instance()
            .set(
                &DataKey::PaymentRecord(agreement_id.clone(), agreement.payment_count),
                &payment_record,
            );

        // Emit event
        env.events().publish(
            (String::from_str(&env, "rent_paid"), agreement_id),
            (amount, landlord_amount, agent_amount, timestamp),
        );

        Ok(())
    }
}

/// Calculate payment split based on commission rate in basis points
/// Returns (landlord_amount, agent_amount)
fn calculate_payment_split(amount: &i128, commission_rate: &u32) -> (i128, i128) {
    // commission_rate is in basis points (1 basis point = 0.01%)
    // Example: 500 basis points = 5%
    let agent_amount = (amount * (*commission_rate as i128)) / 10000;
    let landlord_amount = amount - agent_amount;
    
    (landlord_amount, agent_amount)
}

/// Create an immutable payment record
fn create_payment_record(
    env: &Env,
    agreement_id: &String,
    amount: i128,
    landlord_amount: i128,
    agent_amount: i128,
    tenant: &Address,
    payment_number: u32,
    timestamp: u64,
) -> Result<PaymentRecord, Error> {
    Ok(PaymentRecord {
        agreement_id: agreement_id.clone(),
        payment_number,
        amount,
        landlord_amount,
        agent_amount,
        timestamp,
        tenant: tenant.clone(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Address, Env, String};

    // Helper function to create a test agreement
    fn create_test_agreement(
        env: &Env,
        id: &str,
        tenant: &Address,
        landlord: &Address,
        agent: Option<Address>,
        monthly_rent: i128,
        commission_rate: u32,
        status: AgreementStatus,
    ) -> Agreement {
        Agreement {
            id: String::from_str(env, id),
            tenant: tenant.clone(),
            landlord: landlord.clone(),
            agent,
            monthly_rent,
            commission_rate,
            status,
            total_rent_paid: 0,
            payment_count: 0,
        }
    }

    #[test]
    fn test_pay_rent_without_agent() {
        let env = Env::default();
        env.mock_all_auths();

        let tenant = Address::generate(&env);
        let landlord = Address::generate(&env);
        let token = Address::generate(&env);
        
        let agreement = create_test_agreement(
            &env,
            "agreement_1",
            &tenant,
            &landlord,
            None,
            1000,
            0,
            AgreementStatus::Active,
        );

        env.as_contract(&Address::generate(&env), || {
            env.storage()
                .instance()
                .set(&DataKey::Agreement(agreement.id.clone()), &agreement);

            let result = RentalContract::pay_rent(
                env.clone(),
                agreement.id.clone(),
                token,
                1000,
            );

            assert!(result.is_ok());
        });
    }

    #[test]
    fn test_pay_rent_with_agent_commission() {
        let env = Env::default();
        env.mock_all_auths();

        let tenant = Address::generate(&env);
        let landlord = Address::generate(&env);
        let agent = Address::generate(&env);
        let token = Address::generate(&env);
        
        let agreement = create_test_agreement(
            &env,
            "agreement_2",
            &tenant,
            &landlord,
            Some(agent),
            1000,
            500, // 5% commission
            AgreementStatus::Active,
        );

        env.as_contract(&Address::generate(&env), || {
            env.storage()
                .instance()
                .set(&DataKey::Agreement(agreement.id.clone()), &agreement);

            let result = RentalContract::pay_rent(
                env.clone(),
                agreement.id.clone(),
                token,
                1000,
            );

            assert!(result.is_ok());

            // Verify split: 950 to landlord, 50 to agent
            let (landlord_amt, agent_amt) = calculate_payment_split(&1000, &500);
            assert_eq!(landlord_amt, 950);
            assert_eq!(agent_amt, 50);
        });
    }

    #[test]
    fn test_payment_record_created() {
        let env = Env::default();
        env.mock_all_auths();

        let tenant = Address::generate(&env);
        let landlord = Address::generate(&env);
        let token = Address::generate(&env);
        
        let agreement = create_test_agreement(
            &env,
            "agreement_3",
            &tenant,
            &landlord,
            None,
            1000,
            0,
            AgreementStatus::Active,
        );

        env.as_contract(&Address::generate(&env), || {
            env.storage()
                .instance()
                .set(&DataKey::Agreement(agreement.id.clone()), &agreement);

            RentalContract::pay_rent(
                env.clone(),
                agreement.id.clone(),
                token,
                1000,
            ).unwrap();

            // Verify payment record exists
            let record: Option<PaymentRecord> = env
                .storage()
                .instance()
                .get(&DataKey::PaymentRecord(agreement.id.clone(), 1));
            
            assert!(record.is_some());
            let record = record.unwrap();
            assert_eq!(record.amount, 1000);
            assert_eq!(record.payment_number, 1);
        });
    }

    #[test]
    #[should_panic(expected = "InvalidAmount")]
    fn test_wrong_rent_amount() {
        let env = Env::default();
        env.mock_all_auths();

        let tenant = Address::generate(&env);
        let landlord = Address::generate(&env);
        let token = Address::generate(&env);
        
        let agreement = create_test_agreement(
            &env,
            "agreement_4",
            &tenant,
            &landlord,
            None,
            1000,
            0,
            AgreementStatus::Active,
        );

        env.as_contract(&Address::generate(&env), || {
            env.storage()
                .instance()
                .set(&DataKey::Agreement(agreement.id.clone()), &agreement);

            // Try to pay wrong amount
            RentalContract::pay_rent(
                env.clone(),
                agreement.id.clone(),
                token,
                900, // Wrong amount
            ).unwrap();
        });
    }

    #[test]
    #[should_panic(expected = "AgreementNotActive")]
    fn test_pay_rent_before_deposit() {
        let env = Env::default();
        env.mock_all_auths();

        let tenant = Address::generate(&env);
        let landlord = Address::generate(&env);
        let token = Address::generate(&env);
        
        let agreement = create_test_agreement(
            &env,
            "agreement_5",
            &tenant,
            &landlord,
            None,
            1000,
            0,
            AgreementStatus::Pending, // Not active
        );

        env.as_contract(&Address::generate(&env), || {
            env.storage()
                .instance()
                .set(&DataKey::Agreement(agreement.id.clone()), &agreement);

            RentalContract::pay_rent(
                env.clone(),
                agreement.id.clone(),
                token,
                1000,
            ).unwrap();
        });
    }

    #[test]
    fn test_multiple_rent_payments() {
        let env = Env::default();
        env.mock_all_auths();

        let tenant = Address::generate(&env);
        let landlord = Address::generate(&env);
        let token = Address::generate(&env);
        
        let agreement = create_test_agreement(
            &env,
            "agreement_6",
            &tenant,
            &landlord,
            None,
            1000,
            0,
            AgreementStatus::Active,
        );

        env.as_contract(&Address::generate(&env), || {
            env.storage()
                .instance()
                .set(&DataKey::Agreement(agreement.id.clone()), &agreement);

            // First payment
            RentalContract::pay_rent(
                env.clone(),
                agreement.id.clone(),
                token.clone(),
                1000,
            ).unwrap();

            // Second payment
            RentalContract::pay_rent(
                env.clone(),
                agreement.id.clone(),
                token.clone(),
                1000,
            ).unwrap();

            // Verify agreement totals
            let updated_agreement: Agreement = env
                .storage()
                .instance()
                .get(&DataKey::Agreement(agreement.id.clone()))
                .unwrap();
            
            assert_eq!(updated_agreement.total_rent_paid, 2000);
            assert_eq!(updated_agreement.payment_count, 2);

            // Verify both payment records exist
            let record1: Option<PaymentRecord> = env
                .storage()
                .instance()
                .get(&DataKey::PaymentRecord(agreement.id.clone(), 1));
            let record2: Option<PaymentRecord> = env
                .storage()
                .instance()
                .get(&DataKey::PaymentRecord(agreement.id.clone(), 2));
            
            assert!(record1.is_some());
            assert!(record2.is_some());
        });
    }

    #[test]
    fn test_calculate_payment_split() {
        // Test with no commission
        let (landlord, agent) = calculate_payment_split(&1000, &0);
        assert_eq!(landlord, 1000);
        assert_eq!(agent, 0);

        // Test with 5% commission (500 basis points)
        let (landlord, agent) = calculate_payment_split(&1000, &500);
        assert_eq!(landlord, 950);
        assert_eq!(agent, 50);

        // Test with 10% commission (1000 basis points)
        let (landlord, agent) = calculate_payment_split(&2000, &1000);
        assert_eq!(landlord, 1800);
        assert_eq!(agent, 200);

        // Test with 2.5% commission (250 basis points)
        let (landlord, agent) = calculate_payment_split(&10000, &250);
        assert_eq!(landlord, 9750);
        assert_eq!(agent, 250);
    }
}