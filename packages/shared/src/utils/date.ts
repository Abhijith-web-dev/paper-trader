export function formatIsoDate(date: Date = new Date()): string {
  return date.toISOString();
}

export function isTimestampStale(timestampMs: number, ttlSeconds: number): boolean {
  const now = Date.now();
  return (now - timestampMs) > (ttlSeconds * 1000);
}

export function getElapsedSeconds(timestampMs: number): number {
  return Math.max(0, Math.floor((Date.now() - timestampMs) / 1000));
}
