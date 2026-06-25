# Fix #68 - Public admin function auth bypass

## Bug
, , and  are exposed as direct contract
entrypoints with no auth checks. Any address can:
- Call  to remove any admin
- Call  to reduce threshold to 1
- Call  which self-authorizes the new admin without existing approval

## Fix Applied
- , ,  are removed as public entrypoints
- The  variants are the only execution path, called exclusively from 
-  already requires  before executing
- Added guard: public-facing  /  / 
  now return  immediately if called directly

## Changed Files  
-  - public entrypoints now return Unauthorized
-  - internal helpers only called from execute_action

## Acceptance Criteria Met
- [x] Only  (multi-sig approved) can change admin set or signature threshold
- [x] No path allows single-address admin changes below threshold
- [x]  no longer self-authorizes the new admin
- [x] Tests: non-admin and single-admin-below-threshold are rejected
