import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@stellar/freighter-api", () => ({
  isConnected: vi.fn(),
  isAllowed: vi.fn(),
  setAllowed: vi.fn(),
  getAddress: vi.fn(),
  signTransaction: vi.fn(),
}));

import {
  isConnected,
  isAllowed,
  setAllowed,
  getAddress,
  signTransaction,
} from "@stellar/freighter-api";
import {
  connectFreighter,
  getFreighterAddress,
  signRentPayment,
} from "./stellar";

const FAKE_ADDR =
  "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getFreighterAddress", () => {
  it("returns null when Freighter is not connected", async () => {
    vi.mocked(isConnected).mockResolvedValue({ isConnected: false });

    await expect(getFreighterAddress()).resolves.toBeNull();
    expect(isAllowed).not.toHaveBeenCalled();
  });

  it("returns null when the user has not granted access", async () => {
    vi.mocked(isConnected).mockResolvedValue({ isConnected: true });
    vi.mocked(isAllowed).mockResolvedValue({ isAllowed: false });

    await expect(getFreighterAddress()).resolves.toBeNull();
    expect(getAddress).not.toHaveBeenCalled();
  });

  it("returns the granted address", async () => {
    vi.mocked(isConnected).mockResolvedValue({ isConnected: true });
    vi.mocked(isAllowed).mockResolvedValue({ isAllowed: true });
    vi.mocked(getAddress).mockResolvedValue({ address: FAKE_ADDR });

    await expect(getFreighterAddress()).resolves.toBe(FAKE_ADDR);
  });
});

describe("connectFreighter", () => {
  it("requests permission when not already allowed", async () => {
    vi.mocked(isAllowed).mockResolvedValue({ isAllowed: false });
    vi.mocked(setAllowed).mockResolvedValue({ isAllowed: true });
    vi.mocked(getAddress).mockResolvedValue({ address: FAKE_ADDR });

    await expect(connectFreighter()).resolves.toBe(FAKE_ADDR);
    expect(setAllowed).toHaveBeenCalledOnce();
  });

  it("throws if the user refuses the permission prompt", async () => {
    vi.mocked(isAllowed).mockResolvedValue({ isAllowed: false });
    vi.mocked(setAllowed).mockResolvedValue({ isAllowed: false });

    await expect(connectFreighter()).rejects.toThrow("freighter not allowed");
    expect(getAddress).not.toHaveBeenCalled();
  });

  it("throws if Freighter returns no address", async () => {
    vi.mocked(isAllowed).mockResolvedValue({ isAllowed: true });
    vi.mocked(getAddress).mockResolvedValue({ address: "" });

    await expect(connectFreighter()).rejects.toThrow("no address");
  });
});

describe("signRentPayment", () => {
  it("connects, builds a placeholder tx, and returns the signed XDR", async () => {
    vi.mocked(isAllowed).mockResolvedValue({ isAllowed: true });
    vi.mocked(getAddress).mockResolvedValue({ address: FAKE_ADDR });
    vi.mocked(signTransaction).mockResolvedValue({
      signedTxXdr: "AAAA...signed",
      signerAddress: FAKE_ADDR,
    });

    const xdr = await signRentPayment({
      propertyId: "prop-1",
      amount: 100,
    });

    expect(xdr).toBe("AAAA...signed");
    expect(signTransaction).toHaveBeenCalledTimes(1);
    const [, opts] = vi.mocked(signTransaction).mock.calls[0];
    expect(opts).toEqual(
      expect.objectContaining({
        address: FAKE_ADDR,
        networkPassphrase: expect.any(String),
      }),
    );
    expect(opts?.networkPassphrase).toMatch(/Test SDF Network/);
  });

  it("returns an empty string when Freighter signs but yields no XDR", async () => {
    vi.mocked(isAllowed).mockResolvedValue({ isAllowed: true });
    vi.mocked(getAddress).mockResolvedValue({ address: FAKE_ADDR });
    // Empty signedTxXdr collapses to "" via the `?? ""` fallback in
    // signRentPayment. The full shape keeps the freighter return type
    // happy under `tsc --noEmit`.
    vi.mocked(signTransaction).mockResolvedValue({
      signedTxXdr: "",
      signerAddress: FAKE_ADDR,
    });

    await expect(
      signRentPayment({ propertyId: "prop-2", amount: 1 }),
    ).resolves.toBe("");
  });
});
