import { mockDashboard } from "@/lib/mock";
import { formatUSDC } from "@/lib/format";

export default function DashboardPage() {
  const data = mockDashboard;
  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <h1 className="text-3xl font-semibold">Dashboard</h1>
      <p className="mt-2 text-ink-muted">
        Your active leases, recent rent payments, and escrowed deposits.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <Stat label="Active leases" value={data.activeLeases.toString()} />
        <Stat label="Rent due this month" value={formatUSDC(data.dueThisMonth)} />
        <Stat label="Escrowed deposits" value={formatUSDC(data.escrowed)} />
      </div>

      <section className="mt-12">
        <h2 className="text-xl font-semibold">Recent payments</h2>
        <ul className="mt-4 divide-y divide-ink/10 rounded-2xl border border-ink/10">
          {data.recent.map((p) => (
            <li key={p.id} className="flex items-center justify-between p-4">
              <div>
                <div className="font-medium">{p.property}</div>
                <div className="text-sm text-ink-muted">{p.date}</div>
              </div>
              <div className="font-mono">{formatUSDC(p.amount)}</div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-ink/10 p-5">
      <div className="text-sm text-ink-muted">{label}</div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
    </div>
  );
}
