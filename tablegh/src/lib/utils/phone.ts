/**
 * Ghanaian phone number utilities.
 * All phone numbers stored in E.164 format: +233XXXXXXXXX
 * Valid Ghana mobile regex: ^\+233[2-9]\d{8}$
 *
 * MoMo network detection by prefix (after country code):
 *   MTN:        024, 054, 055, 059
 *   Vodafone/Telecel: 020, 050
 *   AirtelTigo: 027, 057, 026, 056
 */

import { MoMoNetwork } from "@prisma/client";

const GH_PHONE_REGEX = /^\+233[2-9]\d{8}$/;

export type PhoneNormalizeResult =
  | { success: true; e164: string }
  | { success: false; error: string };

/**
 * Normalize a Ghanaian phone number to E.164 format.
 * Handles:
 *   - 0241234567    → +233241234567
 *   - 233241234567  → +233241234567
 *   - +233241234567 → +233241234567 (pass-through)
 */
export function normalizeGhPhone(input: string): PhoneNormalizeResult {
  const stripped = input.replace(/[\s\-().]/g, "");

  let normalized: string;

  if (stripped.startsWith("+233")) {
    normalized = stripped;
  } else if (stripped.startsWith("233")) {
    normalized = "+" + stripped;
  } else if (stripped.startsWith("0") && stripped.length === 10) {
    // Strip leading 0, add +233
    normalized = "+233" + stripped.slice(1);
  } else if (/^[2-9]\d{8}$/.test(stripped)) {
    // 9-digit local number without 0
    normalized = "+233" + stripped;
  } else {
    return { success: false, error: "Unrecognised phone format" };
  }

  if (!GH_PHONE_REGEX.test(normalized)) {
    return {
      success: false,
      error: "Invalid Ghanaian phone number",
    };
  }

  return { success: true, e164: normalized };
}

/**
 * Detect MoMo network from a normalized +233 phone number.
 * Returns null if the prefix doesn't match a known MoMo network.
 */
export function detectMoMoNetwork(e164: string): MoMoNetwork | null {
  // Extract the 3-digit prefix (digits 4-6 of +233XXXXXXXXX)
  const prefix = e164.slice(4, 7); // e.g., "+233241234567" → "024"

  const MTN_PREFIXES = new Set(["024", "054", "055", "059"]);
  const VODAFONE_PREFIXES = new Set(["020", "050"]);
  const AIRTELTIGO_PREFIXES = new Set(["027", "057", "026", "056"]);

  if (MTN_PREFIXES.has(prefix)) return MoMoNetwork.MTN;
  if (VODAFONE_PREFIXES.has(prefix)) return MoMoNetwork.VODAFONE;
  if (AIRTELTIGO_PREFIXES.has(prefix)) return MoMoNetwork.AIRTELTIGO;

  return null;
}

/**
 * Validate a phone is a recognized MoMo number (useful for payment forms).
 */
export function isMoMoNumber(e164: string): boolean {
  return detectMoMoNetwork(e164) !== null;
}

/**
 * Format E.164 number for display: +233 24 123 4567
 */
export function formatGhPhoneDisplay(e164: string): string {
  if (!GH_PHONE_REGEX.test(e164)) return e164;
  const local = e164.slice(4); // "241234567"
  return `+233 ${local.slice(0, 2)} ${local.slice(2, 5)} ${local.slice(5)}`;
}
