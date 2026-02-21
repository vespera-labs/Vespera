## Description

Closes #183

This PR resolves the GitHub Actions CI/CD cache failure stemming from a package setup misalignment where `npm` settings were incorrectly applied to a `pnpm` workspace. 

### Changes Made

* **Frontend Workflows (`frontend-ci-cd.yml`, `frontend-build-check.yml`)**:
  * Configured GitHub Actions to correctly inject the pnpm binary securely by declaring `pnpm/action-setup@v4` strictly before setting up the Node environment. 
  * Replaced the flawed `cache: "npm"` setting to target `cache: "pnpm"` directly attached to `./frontend/pnpm-lock.yaml`.
  * Formatted execution steps globally replacing legacy implementations like `npm ci`, `npm run build`, and `npm test` with their correct respective equivalents: `pnpm install --frozen-lockfile`, `pnpm run build`, and `pnpm test`.

* **Backend Workflows (`backend-ci-cd.yml`, `backend-security-ci-cd.yml`)**:
  * Upgraded dependency tracking logic unifying `pnpm/action-setup@v2` up to `v4` locking at version `"10"`.
  * Swapped execution node order in the core security test pipeline allowing correct instantiation matching the remainder of the ecosystem (`actions/setup-node` executing strictly post-action environment mapping). 

### Type of Change

- [x] Bug fix
- [ ] New feature
- [ ] Refactoring
- [ ] Documentation update

### How to Test

1. Observe the automated GitHub Actions runners executing upon opening this PR.
2. Confirm the exact point historically failing at `Setup Node.js` now transitions to a green status flag.
3. Observe native outputs during execution proving the cache was effectively restored matching the `frontend/pnpm-lock.yaml` file hashes.
