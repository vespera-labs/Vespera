'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { format } from 'date-fns';
import {
  AlertTriangle,
  FileStack,
  Gavel,
  MessageSquareText,
} from 'lucide-react';
import { useAuth } from '@/store/authStore';
import {
  type DashboardDispute,
  loadLandlordDisputes,
} from '@/lib/dashboard-data';

const statusStyles: Record<DashboardDispute['status'], string> = {
  OPEN: 'bg-amber-100 text-amber-700',
  UNDER_REVIEW: 'bg-blue-100 text-blue-700',
  RESOLVED: 'bg-emerald-100 text-emerald-700',
  REJECTED: 'bg-rose-100 text-rose-700',
  WITHDRAWN: 'bg-slate-100 text-slate-600',
};

export default function LandlordDisputesPage() {
  const { user } = useAuth();
  const [disputes, setDisputes] = useState<DashboardDispute[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const run = async () => {
      setLoading(true);
      const nextDisputes = await loadLandlordDisputes();
      if (active) {
        setDisputes(nextDisputes);
        setLoading(false);
      }
    };

    void run();

    return () => {
      active = false;
    };
  }, [user?.id]);

  return (
    <div className="space-y-8">
      <section className="rounded-[2rem] border border-slate-200 bg-linear-to-br from-white via-white to-blue-50 p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-700">
          Resolution Desk
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
          Review and respond to dispute cases from the landlord dashboard
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-slate-600">
          This surface closes the frontend gap around dispute tracking by giving
          landlords a single place to watch case status, evidence volume, and
          outstanding response load.
        </p>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <Stat
            icon={<AlertTriangle className="h-5 w-5 text-amber-600" />}
            label="Open"
            value={`${disputes.filter((item) => item.status === 'OPEN').length}`}
          />
          <Stat
            icon={<Gavel className="h-5 w-5 text-blue-600" />}
            label="Under review"
            value={`${disputes.filter((item) => item.status === 'UNDER_REVIEW').length}`}
          />
          <Stat
            icon={<FileStack className="h-5 w-5 text-emerald-600" />}
            label="Resolved"
            value={`${disputes.filter((item) => item.status === 'RESOLVED').length}`}
          />
        </div>
      </section>

      <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-6 py-5">
          <h2 className="text-lg font-semibold text-slate-900">Active cases</h2>
          <p className="text-sm text-slate-500">
            Each record includes dispute type, comment volume, evidence volume,
            and resolution notes where available.
          </p>
        </div>

        {loading ? (
          <div className="flex min-h-80 items-center justify-center">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" />
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {disputes.map((dispute) => (
              <article key={dispute.id} className="px-6 py-5">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">
                        {dispute.disputeId}
                      </p>
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusStyles[dispute.status]}`}
                      >
                        {dispute.status.replace('_', ' ')}
                      </span>
                    </div>
                    <h3 className="mt-3 text-lg font-semibold text-slate-900">
                      {dispute.propertyName}
                    </h3>
                    <p className="mt-1 text-sm text-slate-500">
                      {dispute.agreementReference} • Raised by{' '}
                      {dispute.counterpartyName}
                    </p>
                    <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
                      {dispute.description}
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3 xl:min-w-96">
                    <MiniCard
                      label="Type"
                      value={dispute.disputeType.replace('_', ' ')}
                    />
                    <MiniCard
                      label="Evidence"
                      value={`${dispute.evidenceCount}`}
                    />
                    <MiniCard
                      label="Comments"
                      value={`${dispute.commentCount}`}
                      icon={<MessageSquareText className="h-4 w-4" />}
                    />
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-4 text-xs text-slate-500">
                  <span>
                    Created {format(new Date(dispute.createdAt), 'MMM d, yyyy')}
                  </span>
                  <span>
                    Updated {format(new Date(dispute.updatedAt), 'MMM d, yyyy')}
                  </span>
                  {typeof dispute.requestedAmount === 'number' ? (
                    <span>
                      Requested {formatCurrency(dispute.requestedAmount)}
                    </span>
                  ) : null}
                </div>

                {dispute.resolution ? (
                  <div className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                    <span className="font-semibold">Resolution:</span>{' '}
                    {dispute.resolution}
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5">
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-50">
        {icon}
      </div>
      <p className="mt-4 text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
        {value}
      </p>
    </div>
  );
}

function MiniCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
        {icon}
        {label}
      </div>
      <p className="mt-2 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0,
  }).format(amount);
}
