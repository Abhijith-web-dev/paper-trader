/**
 * Natural Language Trading Command Engine
 * 100% deterministic client-side parser. Zero latency, zero external API or LLM required.
 * Parses user commands into structured trading intents with autocomplete and parameters.
 */

export const COMMAND_PRESETS = [
  { command: 'open AAPL', desc: 'Navigate to Apple stock chart' },
  { command: 'open RELIANCE.NS', desc: 'Navigate to Reliance chart' },
  { command: 'buy 10 NVDA', desc: 'Open order ticket to buy 10 shares' },
  { command: 'sell 5 TSLA', desc: 'Open order ticket to sell 5 shares' },
  { command: 'add rsi', desc: 'Toggle RSI(14) indicator on chart' },
  { command: 'add bbands', desc: 'Toggle Bollinger Bands(20,2) on chart' },
  { command: 'add sma', desc: 'Toggle 20-period Simple Moving Average' },
  { command: 'add ema', desc: 'Toggle 50-period Exponential Moving Average' },
  { command: 'tf 1d', desc: 'Switch timeframe to 1-Day intraday (5m candles)' },
  { command: 'tf 1m', desc: 'Switch timeframe to 1-Month daily candles' },
  { command: 'screener', desc: 'Launch stock screener & market heatmap' },
  { command: 'backtest', desc: 'Launch strategy backtester (Web Worker)' },
  { command: 'journal', desc: 'Open trading journal & performance analytics' },
  { command: 'risk', desc: 'Open position size & risk-reward calculator' },
  { command: 'alerts', desc: 'Open custom price & indicator alerts manager' },
  { command: 'vault', desc: 'Open Web Crypto encrypted backup & restore' },
  { command: 'predict', desc: 'Predict next stock move using candlestick geometry & rules' },
  { command: 'signals', desc: 'Analyze technical indicators & show signal verdict' },
  { command: 'clear', desc: 'Clear command history' },
];

/**
 * Parse a raw user command string into an actionable intent
 * @param {string} rawInput
 * @param {object} context - { activeStock, activeTimeframe, activeIndicators }
 * @returns {object} { type, payload, feedback }
 */
export function parseTradingCommand(rawInput, context = {}) {
  const input = (rawInput || '').trim();
  if (!input) return { type: 'NOOP', feedback: 'Please type a trading command.' };

  const lower = input.toLowerCase();

  // 1. Navigation / Open Stock
  const navMatch = input.match(/^(?:open|show|chart|goto|go to|view)\s+([A-Za-z0-9_.-]+)/i);
  if (navMatch) {
    const symbol = navMatch[1].toUpperCase();
    return {
      type: 'NAVIGATE_STOCK',
      payload: { symbol },
      feedback: `Navigating to ${symbol} chart...`,
    };
  }

  // 2. Buy Order
  const buyMatch = input.match(/^buy\s+(\d+(?:\.\d+)?)\s*([A-Za-z0-9_.-]*)/i);
  if (buyMatch) {
    const qty = parseFloat(buyMatch[1]);
    const symbol = buyMatch[2] ? buyMatch[2].toUpperCase() : (context.activeStock?.symbol || 'RELIANCE.NS');
    return {
      type: 'OPEN_TRADE',
      payload: { action: 'BUY', qty, symbol },
      feedback: `Opening BUY ticket for ${qty} shares of ${symbol}...`,
    };
  }

  // 3. Sell Order
  const sellMatch = input.match(/^sell\s+(\d+(?:\.\d+)?)\s*([A-Za-z0-9_.-]*)/i);
  if (sellMatch) {
    const qty = parseFloat(sellMatch[1]);
    const symbol = sellMatch[2] ? sellMatch[2].toUpperCase() : (context.activeStock?.symbol || 'RELIANCE.NS');
    return {
      type: 'OPEN_TRADE',
      payload: { action: 'SELL', qty, symbol },
      feedback: `Opening SELL ticket for ${qty} shares of ${symbol}...`,
    };
  }

  // 4. Timeframe Switching
  if (lower.startsWith('tf ') || lower.startsWith('timeframe ')) {
    const tfPart = lower.replace(/^(?:tf|timeframe)\s+/, '').trim().toUpperCase();
    const validTFs = ['1D', '5D', '1M', '6M', '1Y', '5Y'];
    const matched = validTFs.find(t => t.toLowerCase() === tfPart.toLowerCase());
    if (matched) {
      return {
        type: 'SET_TIMEFRAME',
        payload: { timeframe: matched },
        feedback: `Switched chart timeframe to ${matched}.`,
      };
    }
  }

  // 5. Technical Indicators
  if (lower.includes('add rsi') || lower.includes('toggle rsi') || lower === 'rsi') {
    return { type: 'TOGGLE_INDICATOR', payload: { indicator: 'RSI' }, feedback: 'Toggled RSI(14) indicator.' };
  }
  if (lower.includes('add bbands') || lower.includes('toggle bbands') || lower.includes('bollinger')) {
    return { type: 'TOGGLE_INDICATOR', payload: { indicator: 'BBANDS' }, feedback: 'Toggled Bollinger Bands (20, 2).' };
  }
  if (lower.includes('add sma') || lower.includes('toggle sma')) {
    return { type: 'TOGGLE_INDICATOR', payload: { indicator: 'SMA20' }, feedback: 'Toggled 20-period SMA.' };
  }
  if (lower.includes('add ema') || lower.includes('toggle ema')) {
    return { type: 'TOGGLE_INDICATOR', payload: { indicator: 'EMA50' }, feedback: 'Toggled 50-period EMA.' };
  }
  if (lower.includes('clear indicators') || lower.includes('remove indicators')) {
    return { type: 'CLEAR_INDICATORS', payload: {}, feedback: 'Cleared all chart indicator overlays.' };
  }

  // 6. Risk Calculation
  // Syntax: risk [capital] [entry] [sl]
  const riskMatch = input.match(/^risk\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)/i);
  if (riskMatch) {
    const capital = parseFloat(riskMatch[1]);
    const entry = parseFloat(riskMatch[2]);
    const sl = parseFloat(riskMatch[3]);
    return {
      type: 'CALCULATE_RISK',
      payload: { capital, entry, sl },
      feedback: `Calculated position sizing for Capital: ${capital}, Entry: ${entry}, SL: ${sl}`,
    };
  }

  // 7. Modal shortcuts
  if (lower === 'screener' || lower.includes('stock screener') || lower.includes('scanner')) {
    return { type: 'OPEN_SCREENER', payload: {}, feedback: 'Launching Stock Screener...' };
  }
  if (lower === 'backtest' || lower.includes('backtester') || lower.includes('strategy')) {
    return { type: 'OPEN_BACKTESTER', payload: {}, feedback: 'Launching Strategy Backtester...' };
  }
  if (lower === 'journal' || lower.includes('trade log') || lower.includes('diary')) {
    return { type: 'OPEN_JOURNAL', payload: {}, feedback: 'Opening Trading Journal...' };
  }
  if (lower === 'risk' || lower === 'calc' || lower.includes('calculator')) {
    return { type: 'OPEN_RISK_CALCULATOR', payload: {}, feedback: 'Opening Risk & Position Sizer...' };
  }
  if (lower === 'alerts' || lower === 'alert') {
    return { type: 'OPEN_ALERTS', payload: {}, feedback: 'Opening Custom Alerts Manager...' };
  }
  if (lower === 'vault' || lower === 'backup' || lower === 'export') {
    return { type: 'OPEN_VAULT', payload: {}, feedback: 'Opening Encrypted Data Vault...' };
  }
  if (lower === 'predict' || lower.includes('pattern') || lower.includes('prediction')) {
    return { type: 'TRIGGER_PREDICTION', payload: {}, feedback: 'Running algorithmic candlestick pattern prediction...' };
  }
  if (lower === 'signals' || lower === 'signal') {
    return { type: 'TRIGGER_SIGNALS', payload: {}, feedback: 'Evaluating technical signals for current stock...' };
  }

  // 8. Stock Comparison
  const compMatch = input.match(/^compare\s+([A-Za-z0-9_.-]+)\s+([A-Za-z0-9_.-]+)/i);
  if (compMatch) {
    return {
      type: 'COMPARE_STOCKS',
      payload: { stockA: compMatch[1].toUpperCase(), stockB: compMatch[2].toUpperCase() },
      feedback: `Comparing ${compMatch[1].toUpperCase()} vs ${compMatch[2].toUpperCase()}...`,
    };
  }

  // Fallback: If it's just a ticker symbol like "TSLA" or "TCS"
  if (/^[A-Za-z0-9_.-]{2,12}$/.test(input)) {
    return {
      type: 'NAVIGATE_STOCK',
      payload: { symbol: input.toUpperCase() },
      feedback: `Viewing ${input.toUpperCase()}...`,
    };
  }

  return {
    type: 'UNKNOWN',
    feedback: `Unrecognized command "${input}". Press "/" or click commands to see valid syntax.`,
  };
}
