export function formatCurrency(
  amount: number,
  currency: string = 'USD',
  decimals: number = 2
): string {
  if (amount == null || isNaN(amount)) return '$0.00';
  
  let symbol = '$';
  if (currency === 'INR') symbol = '₹';
  else if (currency === 'EUR') symbol = '€';
  else if (currency === 'GBP') symbol = '£';
  else if (currency === 'JPY') symbol = '¥';

  return `${symbol}${amount.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  })}`;
}

export function formatPercent(value: number): string {
  if (value == null || isNaN(value)) return '0.00%';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

export function formatCompactNumber(num: number): string {
  if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
  if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
  if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
  return num.toString();
}

export function formatDate(timestamp: number | string): string {
  const d = new Date(timestamp);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}
