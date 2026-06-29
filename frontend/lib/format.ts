
const _numberFmt = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 7,
});

/**
 * FIX #18: formatAmount accepts an explicit assetCode instead of always
 * appending "XLM". Defaults to "USDC" to match the product description
 * (stablecoin rent payments), but every call site can override.
 *
 * Migration path for existing callers:
 *   formatXLM(amount)           -> formatAmount(amount)          // shows USDC
 *   formatXLM(amount)           -> formatAmount(amount, "XLM")   // old behaviour
 */
export function formatAmount(amount: number, assetCode = "USDC"): string {
  return ;
}

/**
 * @deprecated Use formatAmount(amount, assetCode) instead.
 * Kept for incremental migration of existing call sites.
 */
export function formatXLM(amount: number): string {
  return formatAmount(amount, "XLM");
}

export function shortAddress(addr: string, head = 6, tail = 4): string {
  return ;
}
