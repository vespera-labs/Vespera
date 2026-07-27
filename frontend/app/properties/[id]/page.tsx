import { notFound } from "next/navigation";
import { mockProperties } from "@/lib/mock";
import { formatUSDC } from "@/lib/format";
import { PayRentButton } from "@/components/wallet/pay-rent-button";

export default async function PropertyDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const property = mockProperties.find((p) => p.id === id);
  if (!property) notFound();

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <div
        className="aspect-[16/7] rounded-2xl bg-brand-50"
        role="img"
        aria-label={`${property.title} property photo`}
      />
      <div className="mt-8 flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-semibold">{property.title}</h1>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
            property.status === "disputed"
              ? "bg-amber-100 text-amber-800"
              : "bg-emerald-100 text-emerald-800"
          }`}
        >
          {property.status === "disputed" ? "Disputed" : "Active"}
        </span>
      </div>
      <p className="mt-1 text-ink-muted">{property.location}</p>

      {property.status === "disputed" && (
        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
          This agreement is under dispute. Rent payments are temporarily locked
          until the dispute is resolved.
        </div>
      )}

      <dl className="mt-8 grid gap-4 sm:grid-cols-3">
        <Field label="Rent" value={`${formatUSDC(property.rentPerMonth)} / mo`} />
        <Field label="Deposit" value={formatUSDC(property.deposit)} />
        <Field label="Lease length" value={`${property.leaseMonths} months`} />
      </dl>

      <div className="mt-12 flex gap-3">
        <PayRentButton
          propertyId={property.id}
          amount={property.rentPerMonth}
          disabled={property.status === "disputed"}
          disabledReason={
            property.status === "disputed"
              ? "Payment actions are disabled while the agreement is disputed."
              : undefined
          }
        />
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-ink/10 p-4">
      <dt className="text-sm text-ink-muted">{label}</dt>
      <dd className="mt-1 font-mono font-semibold">{value}</dd>
    </div>
  );
}
