# Security & Risk Architecture: GlobalTrade Simulator

## 1. Authentication & Token Verification
- Frontend authenticates with **Firebase Authentication** using secure JWT tokens.
- Backend routes require a valid `Authorization: Bearer <id_token>` header.
- The Fastify backend validates token signature, issuer, and audience via **Firebase Admin SDK**.
- Service-role credentials and API secrets are never bundled into client assets.

## 2. Trading Integrity & Non-Repudiation
- **Server-Side Price Validation**: The frontend never dictates the execution price. Market orders fill strictly against authenticated backend quotes.
- **Idempotency Keys**: Every order submission requires a client-generated UUID idempotency key to prevent double fills from network retries.
- **Atomic Transactions (`db.runTransaction`)**: Virtual account balance deductions, position updates, and ledger writes are wrapped in single atomic transactions, eliminating race conditions and overselling.
- **Append-Only Ledger**: Balances can always be reconciled by summing the immutable `virtual_account_ledger` entries.

## 3. Data Isolation & Access Controls
- Firestore Security Rules enforce document isolation: `resource.data.userId == request.auth.uid`.
- Mutating virtual accounts, ledger entries, and orders is disabled directly from the client; all mutations must flow through the trusted backend API.

## 4. Rate Limiting & Resource Exhaustion Protection
- `@fastify/rate-limit` enforces a maximum of 200 requests per minute per IP.
- In-memory quote caching (5-second TTL) shields upstream financial providers from rate bans.
