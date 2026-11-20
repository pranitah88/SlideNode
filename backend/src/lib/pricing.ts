const DEFAULT_RATE = "0.40";

/**
 * Read the per-minute USDC rate from the environment.
 */
export function getRate(): number {
  const rateStr = process.env.AI_PRICE_PER_MINUTE_USDC || DEFAULT_RATE;
  const rate = parseFloat(rateStr);
  if (isNaN(rate) || rate < 0) {
    throw new Error(`Invalid AI_PRICE_PER_MINUTE_USDC: ${rateStr}`);
  }
  return rate;
}

/**
 * Calculate billable minutes from raw audio duration.
 * Always rounds up — even 1 second counts as 1 minute.
 */
export function calculateBillableMinutes(durationSeconds: number): number {
  if (durationSeconds <= 0) return 0;
  return Math.ceil(durationSeconds / 60);
}

/**
 * Calculate the USDC price using integer-cent arithmetic
 * to avoid floating-point precision errors.
 *
 * @returns price as a string with 2 decimal places, e.g. "7.60"
 */
export function calculatePrice(billableMinutes: number): string {
  const rate = getRate();
  // Work in whole cents to keep arithmetic exact
  const rateCents = Math.round(rate * 100); // 0.40 → 40
  const totalCents = billableMinutes * rateCents; // integer × integer
  return (totalCents / 100).toFixed(2); // "7.60"
}
