'use client';

import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Clock3,
  Eye,
  Filter,
  Gavel,
  MessageSquareMore,
  RefreshCw,
  Search,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  useAdminDisputes,
  useUpdateAdminDisputeStatus,
  type AdminDisputeRecord,
  type AdminDisputeStatus,
} from '@/lib/query/hooks/use-admin-disputes';

const STATUS_OPTIONS: Array<AdminDisputeStatus | 'ALL'> = [
  'ALL',
  'OPEN',
  'UNDER_REVIEW',
  'RESOLVED',
  'REJECTED',
  'WITHDRAWN',
];

const statusBadgeMap: Record<AdminDisputeStatus, string> = {
  OPEN: 'border-amber-400/30 bg-amber-500/10 text-amber-200',
  UNDER_REVIEW: 'border-blue-400/30 bg-blue-500/10 text-blue-200',
  RESOLVED: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200',
  REJECTED: 'border-rose-400/30 bg-rose-500/10 text-rose-200',
  WITHDRAWN: 'border-slate-400/30 bg-slate-500/10 text-slate-200',
};

export default function AdminDisputesPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<AdminDisputeStatus | 'ALL'>('ALL');
  const [selected, setSelected] = useState<AdminDisputeRecord | null>(null);

  const disputesQuery = useAdminDisputes({ search, status });
  const updateStatus = useUpdateAdminDisputeStatus();

  const disputes = useMemo(
    () => disputesQuery.data ?? [],
    [disputesQuery.data],
  );
  const metrics = useMemo(() => {
    return disputes.reduce(
      (acc, dispute) => {
        acc.total += 1;
        if (dispute.status === 'OPEN') acc.open += 1;
        if (dispute.status === 'UNDER_REVIEW') acc.underReview += 1;
        if (dispute.status === 'RESOLVED') acc.resolved += 1;
        return acc;
      },
      { total: 0, open: 0, underReview: 0, resolved: 0 },
    );
  }, [disputes]);

  const handleQuickAction = async (
    disputeId: string,
    nextStatus: AdminDisputeStatus,
  ) => {
    try {
      const result = await updateStatus.mutateAsync({
        disputeId,
        status: nextStatus,
        resolution:
          nextStatus === 'RESOLVED'
            ? 'Resolved from the admin disputes dashboard.'
            : undefined,
      });

      toast.success(
        result.localOnly
          ? `Status updated locally to ${formatLabel(nextStatus)}`
          : `Dispute moved to ${formatLabel(nextStatus)}`,
      );
    } catch {
      toast.error('Could not update dispute status');
    }
  };

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-3xl border border-white/10 bg-white/5 text-amber-300">
            <Gavel className="h-8 w-8" />
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight text-white">
              Disputes Dashboard
            </h1>
            <p className="text-sm text-blue-200/60">
              Review active cases, triage pending disputes, and take quick
              action without leaving the admin workspace.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void disputesQuery.refetch()}
          className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/10"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <MetricCard
          label="All disputes"
          value={metrics.total}
          icon={<Gavel className="h-5 w-5" />}
          tone="amber"
        />
        <MetricCard
          label="Open"
          value={metrics.open}
          icon={<Clock3 className="h-5 w-5" />}
          tone="amber"
        />
        <MetricCard
          label="Under review"
          value={metrics.underReview}
          icon={<MessageSquareMore className="h-5 w-5" />}
          tone="blue"
        />
        <MetricCard
          label="Resolved"
          value={metrics.resolved}
          icon={<CheckCircle2 className="h-5 w-5" />}
          tone="emerald"
        />
      </div>

      <div className="grid grid-cols-1 gap-3 rounded-3xl border border-white/10 bg-white/5 p-4 lg:grid-cols-[1.4fr_0.8fr]">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-blue-300/40" />
          <input
            className="w-full rounded-2xl border border-white/10 bg-slate-950/70 py-3 pl-11 pr-4 text-sm text-white outline-none"
            placeholder="Search by dispute ID, property, reporter, agreement, or description"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>

        <div className="relative">
          <Filter className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-blue-300/40" />
          <select
            className="w-full appearance-none rounded-2xl border border-white/10 bg-slate-950/70 py-3 pl-11 pr-4 text-sm text-white outline-none"
            value={status}
            onChange={(event) =>
              setStatus(event.target.value as AdminDisputeStatus | 'ALL')
            }
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option} value={option} className="bg-slate-950">
                {option === 'ALL' ? 'All statuses' : formatLabel(option)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="overflow-x-auto rounded-3xl border border-white/10 bg-white/5">
        <table className="w-full min-w-[1080px] text-left text-sm">
          <thead className="border-b border-white/10 text-xs uppercase tracking-[0.16em] text-blue-200/60">
            <tr>
              <th className="px-5 py-4">Dispute</th>
              <th className="px-5 py-4">Parties</th>
              <th className="px-5 py-4">Type</th>
              <th className="px-5 py-4">Status</th>
              <th className="px-5 py-4">Evidence</th>
              <th className="px-5 py-4">Updated</th>
              <th className="px-5 py-4">Quick actions</th>
            </tr>
          </thead>
          <tbody>
            {disputesQuery.isLoading ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-5 py-10 text-center text-blue-200/65"
                >
                  Loading disputes...
                </td>
              </tr>
            ) : disputes.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-5 py-10 text-center text-blue-200/65"
                >
                  No disputes matched the current filters.
                </td>
              </tr>
            ) : (
              disputes.map((dispute) => (
                <tr
                  key={dispute.id}
                  className="border-b border-white/5 align-top last:border-b-0"
                >
                  <td className="px-5 py-4">
                    <p className="font-semibold text-white">
                      {dispute.disputeId}
                    </p>
                    <p className="mt-1 text-xs text-blue-200/65">
                      {dispute.propertyName}
                    </p>
                    <p className="mt-1 text-xs text-blue-300/45">
                      {dispute.agreementReference}
                    </p>
                  </td>
                  <td className="px-5 py-4 text-blue-100/80">
                    <p>{dispute.raisedByName}</p>
                    <p className="mt-1 text-xs text-blue-300/45">
                      Against {dispute.againstName}
                    </p>
                  </td>
                  <td className="px-5 py-4 text-blue-100/80">
                    {formatLabel(dispute.disputeType)}
                  </td>
                  <td className="px-5 py-4">
                    <span
                      className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${statusBadgeMap[dispute.status]}`}
                    >
                      {formatLabel(dispute.status)}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-blue-100/80">
                    <p>{dispute.evidenceCount} files</p>
                    <p className="mt-1 text-xs text-blue-300/45">
                      {dispute.commentCount} comments
                    </p>
                  </td>
                  <td className="px-5 py-4 text-blue-100/80">
                    {new Date(dispute.updatedAt).toLocaleString()}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setSelected(dispute)}
                        className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-white transition hover:bg-white/10"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        View
                      </button>
                      {dispute.status === 'OPEN' && (
                        <button
                          type="button"
                          onClick={() =>
                            void handleQuickAction(dispute.id, 'UNDER_REVIEW')
                          }
                          className="rounded-xl border border-blue-400/25 bg-blue-500/10 px-3 py-2 text-xs font-medium text-blue-100 transition hover:bg-blue-500/20"
                        >
                          Move to review
                        </button>
                      )}
                      {dispute.status !== 'RESOLVED' && (
                        <button
                          type="button"
                          onClick={() =>
                            void handleQuickAction(dispute.id, 'RESOLVED')
                          }
                          className="rounded-xl border border-emerald-400/25 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-100 transition hover:bg-emerald-500/20"
                        >
                          Resolve
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {selected && (
        <div className="rounded-3xl border border-white/10 bg-slate-950/60 p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-white">
                {selected.disputeId}
              </h2>
              <p className="mt-1 text-sm text-blue-200/60">
                {selected.propertyName} • {selected.agreementReference}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white transition hover:bg-white/10"
            >
              Close
            </button>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="space-y-4">
              <InfoPanel
                label="Case summary"
                value={selected.description}
                multiline
              />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <InfoPanel label="Reporter" value={selected.raisedByName} />
                <InfoPanel label="Counterparty" value={selected.againstName} />
                <InfoPanel
                  label="Dispute type"
                  value={formatLabel(selected.disputeType)}
                />
                <InfoPanel
                  label="Requested amount"
                  value={
                    typeof selected.requestedAmount === 'number'
                      ? new Intl.NumberFormat('en-NG', {
                          style: 'currency',
                          currency: 'NGN',
                          maximumFractionDigits: 0,
                        }).format(selected.requestedAmount)
                      : 'Not specified'
                  }
                />
              </div>
            </div>

            <div className="space-y-4">
              <InfoPanel label="Status" value={formatLabel(selected.status)} />
              <InfoPanel
                label="Evidence and comments"
                value={`${selected.evidenceCount} evidence files • ${selected.commentCount} comments`}
              />
              <InfoPanel
                label="Last activity"
                value={new Date(selected.updatedAt).toLocaleString()}
              />
              <InfoPanel
                label="Resolution notes"
                value={selected.resolution ?? 'Pending resolution'}
                multiline
              />
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function MetricCard({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  tone: 'amber' | 'blue' | 'emerald';
}) {
  const toneMap = {
    amber: 'border-amber-400/20 bg-amber-500/10 text-amber-200',
    blue: 'border-blue-400/20 bg-blue-500/10 text-blue-200',
    emerald: 'border-emerald-400/20 bg-emerald-500/10 text-emerald-200',
  };

  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
      <div
        className={`flex h-11 w-11 items-center justify-center rounded-2xl border ${toneMap[tone]}`}
      >
        {icon}
      </div>
      <p className="mt-4 text-xs uppercase tracking-[0.16em] text-blue-200/45">
        {label}
      </p>
      <p className="mt-2 text-3xl font-bold text-white">{value}</p>
    </div>
  );
}

function InfoPanel({
  label,
  value,
  multiline = false,
}: {
  label: string;
  value: string;
  multiline?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <p className="text-xs uppercase tracking-[0.16em] text-blue-200/45">
        {label}
      </p>
      <p className={`mt-2 text-sm text-white ${multiline ? 'leading-6' : ''}`}>
        {value}
      </p>
    </div>
  );
}

function formatLabel(value: string) {
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}
