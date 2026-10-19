# Paper Trading & Ledger Engine: GlobalTrade Simulator

## 1. Simulated Order State Machine

```
              +----------------------------+
              |          PENDING           |
              +--------------+-------------+
                             |
         +-------------------+-------------------+
         |                   |                   |
         v                   v                   v
   +-----------+       +-----------+       +-----------+
   |  FILLED   |       | CANCELLED |       | REJECTED  |
   +-----------+       +-----------+       +-----------+
```

- **PENDING**: Registered in store. Funds held for Buy Limit/Stop orders.
- **FILLED**: Matched against incoming quote conditions. Position created or updated; cash adjusted.
- **CANCELLED**: User requested cancellation. Reserved funds released back to available balance.
- **REJECTED**: Validation or balance failure prior to fill.

## 2. Order Types & Execution Rules

1. **Market Orders**:
   - Buy: Fills immediately at `currentQuote.price * (1 + slippage)` + fee.
   - Sell: Fills immediately at `currentQuote.price * (1 - slippage)` - fee.
2. **Limit Orders**:
   - Buy Limit: Fills when `marketPrice <= limitPrice`.
   - Sell Limit: Fills when `marketPrice >= limitPrice`.
3. **Stop Orders**:
   - Buy Stop: Activates when `marketPrice >= stopPrice`.
   - Sell Stop (Stop Loss): Activates when `marketPrice <= stopPrice`.
4. **Stop-Limit Orders**:
   - Activates when stop threshold is breached, then converts to a limit order.

## 3. Position Accounting (Weighted Average Cost)

When buying additional shares of an existing position:
$$\text{New Average Price} = \frac{(\text{Current Qty} \times \text{Current Avg Price}) + (\text{New Qty} \times \text{New Price})}{\text{Current Qty} + \text{New Qty}}$$

When selling shares:
$$\text{Realized P\&L} = (\text{Sell Qty} \times \text{Sell Price}) - (\text{Sell Qty} \times \text{Avg Cost}) - \text{Fee}$$
