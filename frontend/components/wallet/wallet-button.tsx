"use client";

import { useEffect, useState } from "react";
import { Wallet, LogOut, AlertTriangle } from "lucide-react";
import {
  connectFreighter,
  getFreighterAddress,
  isNetworkMismatch,
} from "@/lib/stellar";

type WalletState = "loading" | "disconnected" | "connected" | "error" | "network-mismatch";

export function WalletButton() {
  const [address, setAddress] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [walletState, setWalletState] = useState<WalletState>("loading");

  useEffect(() => {
    getFreighterAddress()
      .then((addr) => {
        if (addr) {
          setAddress(addr);
          // Check network once we have an address
          isNetworkMismatch().then((mismatch) => {
            setWalletState(mismatch ? "network-mismatch" : "connected");
          });
        } else {
          setWalletState("disconnected");
        }
      })
      .catch(() => {
        setWalletState("disconnected");
      });
  }, []);

  async function handleConnect() {
    setBusy(true);
    setError(null);
    try {
      const addr = await connectFreighter();
      setAddress(addr);
      const mismatch = await isNetworkMismatch();
      setWalletState(mismatch ? "network-mismatch" : "connected");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Connection failed";
      setError(msg);
      setWalletState("error");
    } finally {
      setBusy(false);
    }
  }

  async function handleDisconnect() {
    setAddress(null);
    setError(null);
    setWalletState("disconnected");
  }

  if (walletState === "loading") {
    return (
      <div className="inline-flex items-center gap-2 rounded-full border border-ink/10 px-4 py-2 text-sm text-ink-muted">
        <Wallet className="h-4 w-4 animate-pulse" />
        Checking…
      </div>
    );
  }

  if (walletState === "connected") {
    return (
      <div className="inline-flex items-center gap-2">
        <div className="rounded-l-full border border-ink/10 px-4 py-2 font-mono text-xs">
          {address?.slice(0, 6)}…{address?.slice(-4)}
        </div>
        <button
          onClick={handleDisconnect}
          className="inline-flex items-center gap-1 rounded-r-full border border-l-0 border-ink/10 px-3 py-2 text-xs text-ink-muted hover:text-red-600"
          title="Disconnect wallet"
        >
          <LogOut className="h-3 w-3" />
        </button>
      </div>
    );
  }

  if (walletState === "network-mismatch") {
    return (
      <div className="flex flex-col gap-1">
        <div className="inline-flex items-center gap-2 rounded-full border border-yellow-400 bg-yellow-50 px-4 py-2 text-xs text-yellow-800">
          <AlertTriangle className="h-4 w-4" />
          Network mismatch — switch wallet to{" "}
          {process.env.NEXT_PUBLIC_STELLAR_NETWORK === "PUBLIC"
            ? "Mainnet"
            : "Testnet"}
        </div>
        <button
          onClick={handleDisconnect}
          className="self-start text-xs text-yellow-700 underline"
        >
          Disconnect
        </button>
      </div>
    );
  }

  if (walletState === "error") {
    return (
      <div className="flex flex-col gap-1">
        <button
          onClick={handleConnect}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-full bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-50"
        >
          <Wallet className="h-4 w-4" />
          {busy ? "Connecting…" : "Retry connect"}
        </button>
        {error && (
          <p className="max-w-64 text-xs text-red-600" role="alert">
            {error === "freighter not allowed"
              ? "Freighter access denied. Please allow in the extension."
              : error === "no address"
                ? "Freighter did not return an address. Try reconnecting."
                : "Freighter not installed or not responding. Install the Freighter browser extension to continue."}
          </p>
        )}
      </div>
    );
  }

  // disconnected
  return (
    <div className="flex flex-col gap-1">
      <button
        onClick={handleConnect}
        disabled={busy}
        className="inline-flex items-center gap-2 rounded-full bg-brand px-4 py-2 text-sm text-white hover:bg-brand-600 disabled:opacity-50"
      >
        <Wallet className="h-4 w-4" />
        {busy ? "Connecting…" : "Connect"}
      </button>
    </div>
  );
}