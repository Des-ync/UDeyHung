/**
 * Currency utilities for TableGH.
 * All monetary values stored as integers in pesewas (1 GHS = 100 pesewas).
 * Display format: ₵85.00
 */

/**
 * Format pesewas as GHS display string.
 * @example formatGHS(8500) → "₵85.00"
 * @example formatGHS(100)  → "₵1.00"
 * @example formatGHS(50)   → "₵0.50"
 */
export function formatGHS(pesewas: number): string {
  const ghs = pesewas / 100;
  return `₵${ghs.toFixed(2)}`;
}

/**
 * Parse a GHS string to pesewas integer.
 * Handles: "₵85.00", "85", "85.00", "GHS 85"
 */
export function parseGHSToPesewas(input: string): number {
  const cleaned = input.replace(/[₵GHSghs\s,]/g, "");
  const ghs = parseFloat(cleaned);
  if (isNaN(ghs)) throw new Error(`Invalid GHS amount: ${input}`);
  return Math.round(ghs * 100);
}

/**
 * Price level labels for the Ghanaian market.
 */
export const PRICE_LEVEL_LABELS = {
  BUDGET: "₵",
  MODERATE: "₵₵",
  UPSCALE: "₵₵₵",
  FINE: "₵₵₵₵",
} as const;

export const PRICE_LEVEL_RANGES = {
  BUDGET: "Under ₵50",
  MODERATE: "₵50–₵150",
  UPSCALE: "₵150–₵400",
  FINE: "₵400+",
} as const;
