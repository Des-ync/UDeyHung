import { describe, it, expect } from "vitest";
import {
  normalizeGhPhone,
  detectMoMoNetwork,
  isMoMoNumber,
  formatGhPhoneDisplay,
} from "@/lib/utils/phone";

describe("normalizeGhPhone", () => {
  it("passes through a valid E.164 number unchanged", () => {
    const r = normalizeGhPhone("+233241234567");
    expect(r).toEqual({ success: true, e164: "+233241234567" });
  });

  it("normalises a local 10-digit number starting with 0", () => {
    const r = normalizeGhPhone("0241234567");
    expect(r).toEqual({ success: true, e164: "+233241234567" });
  });

  it("normalises a number starting with 233 (no +)", () => {
    const r = normalizeGhPhone("233241234567");
    expect(r).toEqual({ success: true, e164: "+233241234567" });
  });

  it("normalises a 9-digit number without leading 0 or code", () => {
    const r = normalizeGhPhone("241234567");
    expect(r).toEqual({ success: true, e164: "+233241234567" });
  });

  it("strips whitespace and hyphens", () => {
    const r = normalizeGhPhone("024 123-4567");
    expect(r).toEqual({ success: true, e164: "+233241234567" });
  });

  it("rejects a UK number", () => {
    const r = normalizeGhPhone("+447911123456");
    expect(r.success).toBe(false);
  });

  it("rejects an empty string", () => {
    const r = normalizeGhPhone("");
    expect(r.success).toBe(false);
  });

  it("rejects a number starting with +2330 (invalid Gh mobile)", () => {
    // Ghana mobile numbers use 2-9 after the country code
    const r = normalizeGhPhone("+233012345678");
    expect(r.success).toBe(false);
  });

  it("rejects a too-short number", () => {
    const r = normalizeGhPhone("02412345");
    expect(r.success).toBe(false);
  });

  it("handles Vodafone numbers (020 prefix)", () => {
    const r = normalizeGhPhone("0201234567");
    expect(r).toEqual({ success: true, e164: "+233201234567" });
  });

  it("handles AirtelTigo numbers (027 prefix)", () => {
    const r = normalizeGhPhone("0271234567");
    expect(r).toEqual({ success: true, e164: "+233271234567" });
  });
});

describe("detectMoMoNetwork", () => {
  const cases: Array<[string, "MTN" | "VODAFONE" | "AIRTELTIGO" | null]> = [
    ["+233241234567", "MTN"],
    ["+233541234567", "MTN"],
    ["+233551234567", "MTN"],
    ["+233591234567", "MTN"],
    ["+233201234567", "VODAFONE"],
    ["+233501234567", "VODAFONE"],
    ["+233271234567", "AIRTELTIGO"],
    ["+233571234567", "AIRTELTIGO"],
    ["+233261234567", "AIRTELTIGO"],
    ["+233561234567", "AIRTELTIGO"],
    ["+233231234567", null], // Unknown prefix
  ];

  it.each(cases)(
    "detects network for %s → %s",
    (phone, expected) => {
      expect(detectMoMoNetwork(phone)).toBe(expected);
    }
  );
});

describe("isMoMoNumber", () => {
  it("returns true for MTN number", () => {
    expect(isMoMoNumber("+233241234567")).toBe(true);
  });

  it("returns false for unrecognised prefix", () => {
    expect(isMoMoNumber("+233231234567")).toBe(false);
  });
});

describe("formatGhPhoneDisplay", () => {
  it("formats a valid E.164 number", () => {
    expect(formatGhPhoneDisplay("+233241234567")).toBe("+233 24 123 4567");
  });

  it("returns the input unchanged if not a valid Gh number", () => {
    expect(formatGhPhoneDisplay("+447911123456")).toBe("+447911123456");
  });
});
