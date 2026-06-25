import { describe, it, expect } from "vitest";
import { formatUSDC, shortAddress } from "./format";

describe("formatUSDC", () => {
  it("appends the USDC suffix and uses at least two fraction digits", () => {
    expect(formatUSDC(1)).toBe("1.00 USDC");
  });

  it("preserves up to seven fraction digits", () => {
    expect(formatUSDC(1.2345678)).toBe("1.2345678 USDC");
  });

  it("rounds when the input exceeds seven fraction digits", () => {
    expect(formatUSDC(1.23456785)).toBe("1.2345679 USDC");
  });

  it("groups thousands with locale separators", () => {
    expect(formatUSDC(1234567.89)).toBe("1,234,567.89 USDC");
  });

  it("handles zero", () => {
    expect(formatUSDC(0)).toBe("0.00 USDC");
  });
});

describe("shortAddress", () => {
  const FULL =
    "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";

  it("collapses the middle of a Stellar address", () => {
    expect(shortAddress(FULL)).toBe("GA5ZSE…KZVN");
  });

  it("respects custom head/tail widths", () => {
    expect(shortAddress(FULL, 4, 6)).toBe("GA5Z…K4KZVN");
  });

  it("does not throw on a string shorter than head+tail", () => {
    // slice clamps gracefully; we just want a non-throwing call here.
    expect(shortAddress("abc", 6, 4)).toBe("abc…abc");
  });
});
