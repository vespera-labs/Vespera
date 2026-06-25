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
      <h1 className="mt-8 text-3xl font-semibold">{property.title}</h1>
      <p className="mt-1 text-ink-muted">{property.location}</p>

      <dl className="mt-8 grid gap-4 sm:grid-cols-3">
        <Field label="Rent" value={`${formatXLM(property.rentPerMonth)} / mo`} />
        <Field label="Deposit" value={formatXLM(property.deposit)} />
        <Field label="Lease length" value={`${property.leaseMonths} months`} />
      </dl>

      <div className="mt-12 flex gap-3">
        <PayRentButton
          propertyId={property.id}
          amount={property.rentPerMonth}
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
