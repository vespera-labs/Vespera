// FIX #63: Ensure transferred amount matches credited amount in escrow accounting
// Bug: contract.transfer(&tenant, contract, &amount) uses raw amount while
// total_rent_paid credits amount_in_base (converted). Tokens escrowed != tokens recorded.
// Fix: transfer amount_in_base (the converted value) so escrow accounting stays consistent.

/// Safe payment execution that ensures transfer and credit use the same converted amount.
pub fn make_payment_with_token_fixed(
    env: &Env,
    tenant: Address,
    agreement_id: BytesN<32>,
    token: Address,
    amount: i128,
) -> Result<(), RentalError> {
    tenant.require_auth();

    let agreement = AgreementStorage::get(env, &agreement_id)
        .ok_or(RentalError::AgreementNotFound)?;

    // Convert to base token amount using the configured rate
    let rate = TokenRateStorage::get_rate(env, &token)
        .ok_or(RentalError::UnsupportedToken)?;
    let amount_in_base = (amount as u128 * rate.numerator as u128
        / rate.denominator as u128) as i128;

    // Validate converted amount covers monthly rent
    if amount_in_base < agreement.monthly_rent {
        return Err(RentalError::InsufficientPayment);
    }

    // FIXED: Transfer the SAME amount_in_base that we credit,
    // not the raw unconverted amount
    let token_client = soroban_sdk::token::Client::new(env, &token);
    token_client.transfer(&tenant, &env.current_contract_address(), &amount_in_base);

    // Credit the same amount_in_base to total_rent_paid
    AgreementStorage::add_rent_paid(env, &agreement_id, amount_in_base);

    // Record payment with correct token and converted amount
    PaymentStorage::record(env, &agreement_id, PaymentRecord {
        payer: tenant,
        token: token.clone(),
        raw_amount: amount,
        credited_amount: amount_in_base,
        timestamp: env.ledger().timestamp(),
    });

    Ok(())
}
