"use client";

import { useEffect, useState } from "react";
import { Wallet, LogOut } from "lucide-react";
import { connectFreighter, getFreighterAddress } from "@/lib/stellar";

export function WalletButton() {
  const [address, setAddress] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getFreighterAddress().then(setAddress).catch(() => setAddress(null));
  }, []);

  async function handleConnect() {
    setBusy(true);
    try {
      const addr = await connectFreighter();
      setAddress(addr);
    } finally {
      setBusy(false);
    }
  }

  function handleDisconnect() {
    setAddress(null);
  }

  function handleCopy() {
    if (address) {
      navigator.clipboard.writeText(address);
    }
  }

  return (
    <>
      {address ? (
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            aria-label={"Copy wallet address " + address}
            className="rounded-full border border-ink/10 px-3 py-2 font-mono text-xs hover:bg-ink/5 transition-colors"
            title="Copy address"
          >
            {address.slice(0, 6)}…{address.slice(-4)}
          </button>
          <button
            onClick={handleDisconnect}
            aria-label="Sign out wallet"
            className="rounded-full p-2 text-ink-muted hover:text-ink hover:bg-ink/5 transition-colors"
            title="Disconnect"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <button
          onClick={handleConnect}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-full bg-brand px-4 py-2 text-sm text-white hover:bg-brand-600 disabled:opacity-50"
        >
          <Wallet className="h-4 w-4" />
          {busy ? "Connecting…" : "Connect"}
        </button>
      )}
    </>
  );
}
