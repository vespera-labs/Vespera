import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/lib/stellar", () => ({
  getFreighterAddress: vi.fn(),
  connectFreighter: vi.fn(),
  isNetworkMismatch: vi.fn(),
}));

import { WalletButton } from "./wallet-button";
import { getFreighterAddress, connectFreighter, isNetworkMismatch } from "@/lib/stellar";

const FAKE_ADDR =
  "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("WalletButton", () => {
  it("shows loading state initially", async () => {
    vi.mocked(getFreighterAddress).mockReturnValue(new Promise(() => {}));

    render(<WalletButton />);

    expect(await screen.findByText("Checking…")).toBeInTheDocument();
  });

  it("renders a Connect button when no address is found", async () => {
    vi.mocked(getFreighterAddress).mockResolvedValue(null);

    render(<WalletButton />);

    expect(
      await screen.findByRole("button", { name: "Connect" }),
    ).toBeInTheDocument();
  });

  it("shows the truncated address once Freighter returns one", async () => {
    vi.mocked(getFreighterAddress).mockResolvedValue(FAKE_ADDR);
    vi.mocked(isNetworkMismatch).mockResolvedValue(false);

    render(<WalletButton />);

    expect(await screen.findByText("GA5ZSE…KZVN")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Connect" }),
    ).not.toBeInTheDocument();
  });

  it("flips into the connected state after a successful connect", async () => {
    vi.mocked(getFreighterAddress).mockResolvedValue(null);
    vi.mocked(connectFreighter).mockResolvedValue(FAKE_ADDR);
    vi.mocked(isNetworkMismatch).mockResolvedValue(false);

    render(<WalletButton />);

    const button = await screen.findByRole("button", { name: "Connect" });
    await userEvent.click(button);

    expect(await screen.findByText("GA5ZSE…KZVN")).toBeInTheDocument();
    expect(connectFreighter).toHaveBeenCalledOnce();
  });

  it("falls back to a Connect button if Freighter never resolves an address", async () => {
    vi.mocked(getFreighterAddress).mockRejectedValue(
      new Error("freighter missing"),
    );

    render(<WalletButton />);

    expect(
      await screen.findByRole("button", { name: "Connect" }),
    ).toBeInTheDocument();
  });

  it("shows an error message when connect fails", async () => {
    vi.mocked(getFreighterAddress).mockResolvedValue(null);
    vi.mocked(connectFreighter).mockRejectedValue(
      new Error("freighter not allowed"),
    );

    render(<WalletButton />);

    const button = await screen.findByRole("button", { name: "Connect" });
    await userEvent.click(button);

    expect(
      await screen.findByRole("alert"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Freighter access denied/i),
    ).toBeInTheDocument();
  });

  it("shows a retry button after a connect error", async () => {
    vi.mocked(getFreighterAddress).mockResolvedValue(null);
    vi.mocked(connectFreighter).mockRejectedValue(
      new Error("freighter not allowed"),
    );

    render(<WalletButton />);

    const connectButton = await screen.findByRole("button", { name: "Connect" });
    await userEvent.click(connectButton);

    expect(
      await screen.findByRole("button", { name: /retry/i }),
    ).toBeInTheDocument();
  });

  it("returns to disconnect state after disconnecting", async () => {
    vi.mocked(getFreighterAddress).mockResolvedValue(FAKE_ADDR);
    vi.mocked(isNetworkMismatch).mockResolvedValue(false);

    render(<WalletButton />);

    expect(await screen.findByText("GA5ZSE…KZVN")).toBeInTheDocument();

    const disconnectButton = screen.getByTitle("Disconnect wallet");
    await userEvent.click(disconnectButton);

    expect(
      await screen.findByRole("button", { name: "Connect" }),
    ).toBeInTheDocument();
  });

  it("shows network mismatch warning when wallet network differs", async () => {
    vi.mocked(getFreighterAddress).mockResolvedValue(FAKE_ADDR);
    vi.mocked(isNetworkMismatch).mockResolvedValue(true);

    render(<WalletButton />);

    expect(
      await screen.findByText(/Network mismatch/i),
    ).toBeInTheDocument();
  });

  it("shows install guidance when Freighter is not installed", async () => {
    vi.mocked(getFreighterAddress).mockResolvedValue(null);
    vi.mocked(connectFreighter).mockRejectedValue(
      new Error("freighter not allowed"),
    );

    render(<WalletButton />);

    const button = await screen.findByRole("button", { name: "Connect" });
    await userEvent.click(button);

    expect(
      await screen.findByRole("alert"),
    ).toBeInTheDocument();
  });
});
