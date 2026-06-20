import { describe, it, expect } from "vitest";
import { formatXLM, shortAddress } from "./format";

describe("formatXLM", () => {
  it("appends the XLM suffix and uses at least two fraction digits", () => {
    expect(formatXLM(1)).toBe("1.00 XLM");
  });

  it("preserves up to seven fraction digits (stroop precision)", () => {
    expect(formatXLM(1.2345678)).toBe("1.2345678 XLM");
  });

  it("rounds when the input exceeds stroop precision", () => {
    // 8 fractional digits — last digit is dropped via standard rounding.
    expect(formatXLM(1.23456785)).toBe("1.2345679 XLM");
  });

  it("groups thousands with locale separators", () => {
    expect(formatXLM(1234567.89)).toBe("1,234,567.89 XLM");
  });

  it("handles zero", () => {
    expect(formatXLM(0)).toBe("0.00 XLM");
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
