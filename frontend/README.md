# Vespera — Frontend

Next.js 15 app for the Vespera rental payments protocol on Stellar.

## Stack

- Next.js 15 (App Router) + React 19
- TypeScript
- Tailwind CSS
- TanStack Query
- Freighter wallet + `@stellar/stellar-sdk`

## Run

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

## Environment Variables

Copy `.env.example` to `.env.local` and fill in the values:

| Variable | Description | Example |
|---|---|---|
| `NEXT_PUBLIC_STELLAR_NETWORK` | Stellar network to connect to. Use `TESTNET` for development, `PUBLIC` for production. | `TESTNET` |
| `NEXT_PUBLIC_HORIZON_URL` | Horizon API endpoint for the selected Stellar network. | `https://horizon-testnet.stellar.org` |
| `NEXT_PUBLIC_RENTAL_CONTRACT_ID` | The Soroban contract ID for the deployed rental contract. Obtain from the contract deployment output or the contracts README. | `CDEF...` |

All variables are prefixed with `NEXT_PUBLIC_` so they are available in the browser at build time.

## Layout

```
app/
  layout.tsx        root layout + providers
  page.tsx          landing
  dashboard/        tenant + landlord dashboard
  properties/       listing + detail pages
  payments/         on-chain receipts
  api/health        liveness probe
components/
  layout/           header, footer
  wallet/           connect button, pay-rent button
lib/
  stellar.ts        Freighter + Soroban helpers
  format.ts         display helpers
  mock.ts           seed data for local dev
```

## Stellar integration

`lib/stellar.ts` wraps `@stellar/freighter-api` for wallet connect and
`signTransaction`. Replace `signRentPayment` with a real call into the
Soroban rental contract once `NEXT_PUBLIC_RENTAL_CONTRACT_ID` is set.
