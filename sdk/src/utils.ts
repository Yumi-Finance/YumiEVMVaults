/** Grace period after maturity before admin can sweep orphaned repay funds (180 days in seconds). */
export const SWEEP_GRACE_SECONDS = 15_552_000n;

/** Maximum allowed APR in basis points (4000 bps = 40%). */
export const MAX_APR_BPS = 4000;

/** BPS_YEAR_DIVISOR = 10_000 × 365 × 24 × 3600 = 315_360_000_000 */
const BPS_YEAR_DIVISOR = 315_360_000_000n;

/** Format a token amount (smallest units) to a human-readable decimal string. */
export function formatUnits(val: bigint, decimals: number): string {
  const s = val.toString().padStart(decimals + 1, "0");
  const whole = s.slice(0, s.length - decimals) || "0";
  const frac = s.slice(s.length - decimals);
  return `${whole}.${frac}`;
}

/** Parse a human-readable decimal string to smallest units. */
export function parseUnits(val: string, decimals: number): bigint {
  const [whole = "0", frac = ""] = val.split(".");
  const paddedFrac = frac.slice(0, decimals).padEnd(decimals, "0");
  return BigInt(whole + paddedFrac);
}

/** Shorten an address to "0xabcd...1234" format. */
export function shortAddress(addr: string, chars: number = 4): string {
  return addr.slice(0, chars + 2) + "..." + addr.slice(-chars);
}

/** Format a unix timestamp (seconds) to a locale date string. */
export function formatTimestamp(ts: bigint): string {
  return new Date(Number(ts) * 1000).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Pool capacity fill percentage (0–100). */
export function poolFillPercent(totalDeposited: bigint, maxTotalDeposit: bigint): number {
  if (maxTotalDeposit <= 0n) return 0;
  return Math.min(Number((totalDeposited * 100n) / maxTotalDeposit), 100);
}

/** Days until pool maturity (0 if already matured). */
export function daysToMaturity(maturityTs: bigint, nowTs?: bigint): number {
  const now = nowTs ?? BigInt(Math.floor(Date.now() / 1000));
  const secs = Number(maturityTs - now);
  return Math.max(0, Math.ceil(secs / 86400));
}

/** Deposit deadline timestamp, or null if there's no deadline offset. */
export function depositDeadlineTs(maturityTs: bigint, depositDeadlineOffset: bigint): bigint | null {
  if (depositDeadlineOffset === 0n) return null;
  return maturityTs - depositDeadlineOffset;
}

/**
 * Compute expected return (principal + interest).
 * Formula: amount + (amount × aprBps × durationSecs) / 315_360_000_000
 */
export function calcExpectedReturn(amount: bigint, aprBps: number, durationSecs: bigint): bigint {
  const interest = (amount * BigInt(aprBps) * durationSecs) / BPS_YEAR_DIVISOR;
  return amount + interest;
}

/** APR in basis points formatted as a percentage string (e.g. "12.50"). */
export function aprBpsToPercent(bps: number): string {
  return (bps / 100).toFixed(2);
}

/** Whether the pool has matured. */
export function isMatured(maturityTs: bigint, nowTs?: bigint): boolean {
  const now = nowTs ?? BigInt(Math.floor(Date.now() / 1000));
  return now >= maturityTs;
}

/** Whether deposits are still accepted. */
export function isDepositOpen(maturityTs: bigint, depositDeadlineOffset: bigint, nowTs?: bigint): boolean {
  const now = nowTs ?? BigInt(Math.floor(Date.now() / 1000));
  if (depositDeadlineOffset === 0n) return now < maturityTs;
  const deadline = maturityTs - depositDeadlineOffset;
  return now <= deadline;
}
