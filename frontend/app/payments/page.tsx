import { mockDashboard } from "@/lib/mock";
import { formatUSDC } from "@/lib/format";

export default function PaymentsPage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="text-3xl font-semibold">Payments</h1>
      <p className="mt-2 text-ink-muted">
        Receipts for every rent payment, anchored to a Soroban transaction.
      </p>

      <ul className="mt-8 divide-y divide-ink/10 rounded-2xl border border-ink/10">
        {mockDashboard.recent.map((p) => (
          <li key={p.id} className="grid grid-cols-4 items-center gap-4 p-4">
            <div className="font-medium">{p.property}</div>
            <div className="text-sm text-ink-muted">{p.date}</div>
            <div className="font-mono text-sm text-ink-muted truncate">
              {p.txHash}
            </div>
            <div className="text-right font-mono font-semibold">
              {formatUSDC(p.amount)}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
