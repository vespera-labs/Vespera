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
