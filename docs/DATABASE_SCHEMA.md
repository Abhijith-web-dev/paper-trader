# Database Schema & Storage: GlobalTrade Simulator

## 1. Firebase Firestore Collections

### `users/{userId}`
- `id`: string (Firebase Auth UID)
- `email`: string
- `displayName`: string
- `photoURL`: string (Supabase public storage URL)
- `role`: `'user' | 'admin'`
- `createdAt`: number (Epoch ms)

### `user_preferences/{userId}`
- `userId`: string
- `baseCurrency`: `'USD' | 'INR' | 'EUR'`
- `timezone`: string (e.g. `'America/New_York'`, `'Asia/Kolkata'`)
- `experienceLevel`: `'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED'`
- `theme`: `'dark' | 'light' | 'system'`

### `virtual_accounts/{accountId}`
- `id`: string
- `userId`: string
- `name`: string
- `baseCurrency`: string
- `initialBalance`: number
- `availableCash`: number
- `reservedCash`: number
- `createdAt`: number
- `updatedAt`: number

### `virtual_account_ledger/{ledgerId}`
- `id`: string
- `accountId`: string
- `userId`: string
- `type`: `'INITIAL_DEPOSIT' | 'ORDER_HOLD' | 'ORDER_RELEASE' | 'BUY_EXECUTION' | 'SELL_EXECUTION' | 'FEE'`
- `amount`: number (signed float; positive for inflows, negative for outflows)
- `balanceAfter`: number
- `referenceId`: string (Order ID)
- `idempotencyKey`: string
- `description`: string
- `timestamp`: number

### `orders/{orderId}`
- `id`: string
- `userId`: string
- `accountId`: string
- `symbol`: string
- `exchange`: string
- `side`: `'BUY' | 'SELL'`
- `type`: `'MARKET' | 'LIMIT' | 'STOP' | 'STOP_LIMIT'`
- `status`: `'PENDING' | 'FILLED' | 'CANCELLED' | 'REJECTED' | 'EXPIRED'`
- `quantity`: number
- `filledQuantity`: number
- `limitPrice`: number (optional)
- `stopPrice`: number (optional)
- `avgFillPrice`: number (optional)
- `fees`: number
- `slippage`: number
- `idempotencyKey`: string
- `placedAt`: number
- `filledAt`: number (optional)

### `positions/{accountId_symbol}`
- `id`: string
- `accountId`: string
- `userId`: string
- `symbol`: string
- `exchange`: string
- `quantity`: number
- `averageEntryPrice`: number
- `currentPrice`: number
- `unrealizedPnl`: number
- `realizedPnl`: number
- `totalCost`: number
- `marketValue`: number
- `updatedAt`: number

---

## 2. Supabase Storage Buckets

1. `avatars` (Public read, authenticated upload for profile pictures).
2. `learning-materials` (Public read, admin write for educational PDF guides and infographics).
3. `trade-receipts` (Private, user-isolated storage for exported trade statement PDF receipts).
