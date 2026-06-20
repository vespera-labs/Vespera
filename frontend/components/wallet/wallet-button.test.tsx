import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/lib/stellar", () => ({
  getFreighterAddress: vi.fn(),
  connectFreighter: vi.fn(),
}));

import { WalletButton } from "./wallet-button";
import { getFreighterAddress, connectFreighter } from "@/lib/stellar";

const FAKE_ADDR =
  "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("WalletButton", () => {
  it("renders a Connect button when no address is found", async () => {
    vi.mocked(getFreighterAddress).mockResolvedValue(null);

    render(<WalletButton />);

    expect(
      await screen.findByRole("button", { name: /connect/i }),
    ).toBeInTheDocument();
  });

  it("shows the truncated address once Freighter returns one", async () => {
    vi.mocked(getFreighterAddress).mockResolvedValue(FAKE_ADDR);

    render(<WalletButton />);

    // First six + last four — matches the inline truncation in the
    // component.
    expect(await screen.findByText("GA5ZSE…KZVN")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /connect/i }),
    ).not.toBeInTheDocument();
  });

  it("flips into the connected state after a successful connect", async () => {
    vi.mocked(getFreighterAddress).mockResolvedValue(null);
    vi.mocked(connectFreighter).mockResolvedValue(FAKE_ADDR);

    render(<WalletButton />);

    const button = await screen.findByRole("button", { name: /connect/i });
    await userEvent.click(button);

    expect(await screen.findByText("GA5ZSE…KZVN")).toBeInTheDocument();
    expect(connectFreighter).toHaveBeenCalledOnce();
  });

  it("falls back to a Connect button if Freighter never resolves an address", async () => {
    // The component reads getFreighterAddress on mount; if the call
    // rejects (e.g. extension missing) it catches and stays in the
    // disconnected state.
    vi.mocked(getFreighterAddress).mockRejectedValue(
      new Error("freighter missing"),
    );

    render(<WalletButton />);

    expect(
      await screen.findByRole("button", { name: /connect/i }),
    ).toBeInTheDocument();
  });
});
