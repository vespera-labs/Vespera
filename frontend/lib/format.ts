const usdc = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 7,
});

export function formatUSDC(amount: number): string {
  return `${usdc.format(amount)} USDC`;
}

export function shortAddress(addr: string, head = 6, tail = 4): string {
  return `${addr.slice(0, head)}…${addr.slice(-tail)}`;
}

export function formatContractError(error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error);
  if (msg.includes("KycNotVerified") || msg.includes("KYC_NOT_CLEARED")) {
    return "Identity verification required to complete this action.";
  }
  if (msg.includes("ScreeningNotClear")) {
    return "Account screening pending. Please contact support.";
  }
  return msg;
}
