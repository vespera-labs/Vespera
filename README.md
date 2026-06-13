<p align="center">
  <img src="assets/vespera-banner.svg" alt="Vespera" width="100%"/>
</p>

<h1 align="center">Vespera</h1>

<p align="center">
  <em>Programmable rental payments on Stellar. Landlords, agents and tenants move rent and deposits through Soroban contracts instead of cash, bank transfers, or trust.</em>
</p>

<p align="center">
  <a href="https://github.com/vespera-labs/Vespera/actions"><img alt="CI" src="https://img.shields.io/badge/CI-passing-brightgreen"/></a>
  <a href="https://github.com/vespera-labs/Vespera/blob/main/LICENSE"><img alt="License" src="https://img.shields.io/badge/license-MIT-blue"/></a>
  <img alt="Built on" src="https://img.shields.io/badge/built%20on-Stellar%20Soroban-7b4bd8"/>
  <img alt="Stack" src="https://img.shields.io/badge/stack-Rust%20%7C%20Next.js%20%7C%20NestJS-1e4a72"/>
</p>

<p align="center">
  <a href="#overview">Overview</a> ·
  <a href="#how-it-works">How it works</a> ·
  <a href="#architecture">Architecture</a> ·
  <a href="#smart-contracts">Smart contracts</a> ·
  <a href="#getting-started">Getting started</a> ·
  <a href="#roadmap">Roadmap</a> ·
  <a href="#contributing">Contributing</a>
</p>

---

## Overview

Vespera is an open source rental payments platform built on Stellar. It connects landlords, house agents and tenants through programmable escrow, on chain rent receipts, and automated commission distribution, so that every party in a tenancy has a verifiable record of what was paid, when, and to whom.

The project focuses on emerging markets where rental disputes, missing receipts, and opaque commission structures are everyday problems. By pushing the parts that need trust (deposits, rent settlement, receipts) onto Soroban smart contracts, and keeping the parts that need flexibility (listings, messaging, metadata) off chain, Vespera gives each side of the deal the guarantees they actually need without forcing them to learn blockchain.

## The problem

Rental markets in most of Africa, South Asia and Southeast Asia run on a combination of cash, bank transfers, and informal trust. That setup produces a predictable set of failures:

- Tenants pay deposits with no enforceable proof of payment.
- Landlords chase late rent with no automated settlement path.
- Agents collect commissions from both sides with no public accounting.
- Disputes take months to resolve because there is no shared record.
- Cross border payments (diaspora tenants, foreign landlords) add days of delay and costly FX spread.

These problems are not a function of bad actors. They are a function of missing infrastructure.

## How it works

1. An agent registers a property on chain with terms (rent amount, deposit, commission split).
2. A tenant signs the rental agreement and escrows the deposit in a Soroban contract.
3. Each month the tenant pays rent in USDC to the rental contract.
4. The contract releases the rent to the landlord, the commission to the agent, and writes a receipt to the ledger.
5. At the end of the tenancy, the deposit is released according to the terms agreed at the start, with disputes routed through a defined resolution flow.

Nothing in steps 3 through 5 requires a third party to be online or to be trusted. The contracts enforce what was agreed at step 1.

## Architecture

```
vespera/
  contract/           Soroban smart contracts (Rust)
    contracts/
      agent_registry/
      dispute_resolution/
      escrow/
      payment/
      property_registry/
      rent_obligation/
      user_profile/
  backend/            NestJS API, indexer and notification service (TypeScript)
    src/
      blockchain/     Horizon listener and Soroban client
      database/       PostgreSQL access layer
      health/         readiness and liveness endpoints
      common/         shared utilities
  frontend/           Next.js application (TypeScript, React)
    app/              routes and pages
    components/       UI components
    contexts/         wallet and session contexts
  scripts/            deployment and devnet tooling
```

### Data flow

- **On chain**: tenancies, deposits, rent payments, commissions, receipts, dispute records.
- **Off chain**: property listings, photos, agent contact data, tenant profiles, notifications.
- **Indexer**: reads Horizon, writes the indexed state into PostgreSQL so the frontend can render fast without re-reading the ledger.

## Smart contracts

| contract | purpose |
|---|---|
| `user_profile` | identity and verification handles for landlords, agents and tenants |
| `property_registry` | on chain listing of units with terms and metadata pointers |
| `agent_registry` | registered agents with reputation and commission history |
| `rent_obligation` | the rental agreement itself, signed by tenant and landlord |
| `escrow` | holds the security deposit for the duration of the tenancy |
| `payment` | accepts monthly rent in USDC and routes it per the agreement |
| `dispute_resolution` | structured path for raising and resolving disputes |

All contracts are written in Rust with the Soroban SDK. They are tested with the Soroban contract test framework and exercised end to end against Stellar futurenet.

## Tech stack

- **Smart contracts**: Rust, Soroban SDK
- **Backend**: NestJS, TypeScript, PostgreSQL, Horizon client
- **Frontend**: Next.js 16, React, TanStack Query, Freighter wallet, Leaflet (maps), Framer Motion
- **Tooling**: pnpm, Vitest, Storybook, Docker Compose, ESLint, Prettier

## Getting started

### Prerequisites

- Rust 1.78 or newer and the Soroban CLI
- Node.js 20 or newer and pnpm 9
- Docker and Docker Compose
- A Stellar testnet account with funded XLM and USDC

### Clone and bootstrap

```bash
git clone https://github.com/vespera-labs/Vespera.git
cd Vespera
```

### Run the full stack with Docker Compose

```bash
docker compose up -d
```

This brings up:

- the Soroban local network for local contract calls
- PostgreSQL
- the NestJS backend at http://localhost:4000
- the Next.js frontend at http://localhost:3000

### Manual setup (without Docker)

**Contracts**

```bash
cd contract
make build
make test
```

**Backend**

```bash
cd backend
pnpm install
pnpm run start:dev
```

**Frontend**

```bash
cd frontend
pnpm install
pnpm run dev
```

## Roadmap

- [x] Core contracts implemented and unit tested
- [x] Full local stack with Docker Compose
- [x] Freighter wallet integration on the frontend
- [x] PostgreSQL indexer reading Horizon
- [ ] Futurenet end to end test pass (in progress)
- [ ] Security review of the escrow contract
- [ ] Dispute resolution flow user testing
- [ ] Cross border rent payments (diaspora flows)
- [ ] Public testnet launch
- [ ] Mainnet pilot in one market

## Contributing

We welcome contributions across the stack. Open issues are tagged by area (`contract`, `backend`, `frontend`, `docs`) and by difficulty (`good first issue`, `help wanted`).

1. Pick an unassigned issue tagged for your area.
2. Comment on the issue so a maintainer can assign you.
3. Fork the repo and create a branch named after the issue (`feat/123-short-description`).
4. Submit a pull request that references the issue number.
5. A maintainer will review within 48 hours.

Read [CONTRIBUTING.md](frontend/CONTRIBUTING.md) for full coding standards and review expectations.

## Security

Vespera handles real funds. If you find a vulnerability:

- Do **not** open a public issue.
- Read [SECURITY.md](SECURITY.md) for the disclosure process and contact channel.

The escrow and payment contracts are slated for external audit before mainnet. Audit reports will be linked here when available.

## License

[MIT](LICENSE)
