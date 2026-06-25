# Fix #69 - Escrow approval binding

## Bug
 reads approvals for  target but sends  to .
Two parties approving a depositor-refund can be silently redirected to pay the beneficiary.

## Fix Applied
Added  which:
- Binds each approval to a hash of  - not just the release_to address
- Prevents redirection: approvals for one deduction amount cannot satisfy a different amount
- Requires  on every approval path
- Escrow-isolated: each escrow ID has separate approval counters

## Changed Files
-  - new  function
-  - new action-hash keyed approval storage helpers
