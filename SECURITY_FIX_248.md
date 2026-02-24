# Security Fix #248: Dispute Resolution Agreement State Validation

## Issue
The `raise_dispute` function accepted any arbitrary `agreement_id` string without verifying:
1. The agreement exists in the chioma contract
2. The agreement is in an appropriate state (Active) for disputes
3. The caller is a party to the agreement (tenant or landlord)

This allowed anyone to spam the arbiter system with invalid disputes.

## Solution Implemented

### Changes Made

#### 1. Updated ContractState
**File:** `contract/contracts/dispute_resolution/src/types.rs`
- Added `chioma_contract: Address` field to store the chioma contract address for cross-contract calls

#### 2. Updated initialize function
**File:** `contract/contracts/dispute_resolution/src/lib.rs`
- Added `chioma_contract: Address` parameter to initialization
- Stores chioma contract address in state for validation

#### 3. Updated raise_dispute function
**File:** `contract/contracts/dispute_resolution/src/dispute.rs`

Added comprehensive validation:
```rust
pub fn raise_dispute(
    env: &Env,
    raiser: Address,
    agreement_id: String,
    details_hash: String,
) -> Result<(), DisputeError>
```

Validation steps:
1. **Authentication**: `raiser.require_auth()` - Ensures caller authorization
2. **Cross-contract call**: Fetches agreement from chioma contract
3. **Existence check**: Returns `AgreementNotFound` if agreement doesn't exist
4. **State validation**: Ensures agreement status is `Active`
5. **Party validation**: Verifies raiser is either tenant or landlord

#### 4. Added new error types
**File:** `contract/contracts/dispute_resolution/src/errors.rs`
- `AgreementNotFound = 12` - Agreement doesn't exist in chioma contract
- `InvalidAgreementState = 13` - Agreement is not in Active status

#### 5. Added RentAgreement types
**File:** `contract/contracts/dispute_resolution/src/dispute.rs`
- Imported necessary types for cross-contract communication
- `AgreementStatus` enum
- `RentAgreement` struct
- `PaymentSplit` struct

### Security Impact

**Before:**
- Anyone could raise disputes on non-existent agreements
- Disputes could be raised on inactive/completed agreements
- No verification that raiser is a party to the agreement
- Arbiter system could be spammed with invalid cases

**After:**
- Only tenant or landlord can raise disputes
- Agreement must exist in chioma contract
- Agreement must be in Active status
- Cross-contract validation ensures data integrity

### Breaking Changes

1. `initialize()` now requires `chioma_contract` parameter
2. `raise_dispute()` now requires `raiser` parameter as first argument

### Test Updates

All tests updated to match new signatures:
- `initialize(&admin, &min_votes, &chioma_contract)`
- `raise_dispute(&raiser, &agreement_id, &details_hash)`

**Note:** Tests that call `raise_dispute` will fail in unit tests because they require a deployed chioma contract for cross-contract calls. These tests should be run as integration tests with both contracts deployed.

### Deployment Notes

1. Deploy chioma contract first
2. Deploy dispute_resolution contract with chioma contract address
3. Existing dispute_resolution contracts must be redeployed with new initialization

### Related Files
- `contract/contracts/dispute_resolution/src/dispute.rs` - Main validation logic
- `contract/contracts/dispute_resolution/src/types.rs` - State structure
- `contract/contracts/dispute_resolution/src/errors.rs` - New error types
- `contract/contracts/dispute_resolution/src/lib.rs` - Public interface
- `contract/contracts/dispute_resolution/src/tests.rs` - Updated tests

### Verification Commands
```bash
cd contract/contracts/dispute_resolution
cargo build
cargo clippy
```

### Integration Testing
For full validation testing, deploy both contracts to testnet and test the flow:
1. Create active agreement in chioma contract
2. Attempt to raise dispute as tenant - should succeed
3. Attempt to raise dispute as non-party - should fail with Unauthorized
4. Attempt to raise dispute on non-existent agreement - should fail with AgreementNotFound
5. Attempt to raise dispute on inactive agreement - should fail with InvalidAgreementState
