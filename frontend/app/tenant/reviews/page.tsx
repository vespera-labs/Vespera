'use client';

import { useEffect, useState } from 'react';
import { MessageSquareHeart, Star } from 'lucide-react';
import { ReviewList } from '@/components/reviews/ReviewList';
import type { ReviewFormData } from '@/components/reviews/ReviewForm';
import { useAuth } from '@/store/authStore';
import {
  buildRatingStats,
  type DashboardReview,
  loadReviewWorkspace,
  submitReview,
  type ReviewTarget,
} from '@/lib/dashboard-data';

export default function TenantReviewsPage() {
  const { user } = useAuth();
  const [targets, setTargets] = useState<ReviewTarget[]>([]);
  const [reviews, setReviews] = useState<DashboardReview[]>([]);

  useEffect(() => {
    let active = true;

    const run = async () => {
      const workspace = await loadReviewWorkspace('tenant');
      if (active) {
        setTargets(workspace.targets);
        setReviews(workspace.reviews);
      }
    };

    void run();

    return () => {
      active = false;
    };
  }, [user?.id]);

  const handleSubmitReview = async (data: ReviewFormData) => {
    const activeTarget = targets[0];
    if (!activeTarget) return;

    await submitReview(activeTarget, data);

    setReviews((current) => [
      {
        id: `review-${Date.now()}`,
        rating: data.rating,
        comment: data.comment,
        createdAt: new Date().toISOString(),
        propertyName: activeTarget.propertyName,
        context: activeTarget.context,
        author: {
          id: user?.id ?? 'tenant-user',
          name: 'You',
          isVerified: true,
          role: 'TENANT',
        },
      },
      ...current,
    ]);

    setTargets((current) => current.slice(1));
  };

  return (
    <div className="space-y-8">
      <section className="rounded-[2rem] border border-amber-200 bg-linear-to-br from-amber-50 via-white to-orange-50 p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-700">
          Reviews & Ratings
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
          Publish lease and maintenance feedback from the tenant portal
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-slate-600">
          Review workflows are now surfaced directly in the dashboard so tenants
          can rate landlords and service interactions instead of losing that
          feedback loop after checkout or issue resolution.
        </p>

        <div className="mt-6 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[1.5rem] border border-white bg-white/90 p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-100">
                <MessageSquareHeart className="h-5 w-5 text-amber-700" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  Pending review prompts
                </p>
                <p className="text-sm text-slate-500">
                  Use the form below to submit the next due review.
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {targets.length === 0 ? (
                <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-500">
                  No pending prompts right now.
                </p>
              ) : (
                targets.map((target) => (
                  <div
                    key={target.id}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="font-semibold text-slate-900">
                          {target.name}
                        </p>
                        <p className="text-sm text-slate-500">
                          {target.propertyName} • {target.context}
                        </p>
                      </div>
                      <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                        {target.role}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-slate-500">
                      {target.dueLabel}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-white bg-slate-950 p-5 text-white">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10">
                <Star className="h-5 w-5 text-amber-300" />
              </div>
              <div>
                <p className="text-sm font-semibold">Feedback coverage</p>
                <p className="text-sm text-slate-300">
                  Track submitted reviews across lease and maintenance contexts.
                </p>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-4">
              <InfoCard
                label="Submitted"
                value={`${reviews.length}`}
                theme="dark"
              />
              <InfoCard
                label="Pending"
                value={`${targets.length}`}
                theme="dark"
              />
            </div>
          </div>
        </div>
      </section>

      <ReviewList
        reviews={reviews}
        stats={buildRatingStats(reviews)}
        onSubmitReview={handleSubmitReview}
        title="Your review history"
        subtitle="Leave the next pending review and keep past feedback visible in one place."
      />
    </div>
  );
}

function InfoCard({
  label,
  value,
  theme,
}: {
  label: string;
  value: string;
  theme: 'dark' | 'light';
}) {
  return (
    <div
      className={
        theme === 'dark'
          ? 'rounded-2xl border border-white/10 bg-white/5 p-4'
          : 'rounded-2xl border border-slate-200 bg-white p-4'
      }
    >
      <p
        className={
          theme === 'dark'
            ? 'text-xs font-semibold uppercase tracking-[0.18em] text-slate-300'
            : 'text-xs font-semibold uppercase tracking-[0.18em] text-slate-500'
        }
      >
        {label}
      </p>
      <p className="mt-2 text-3xl font-bold tracking-tight">{value}</p>
    </div>
  );
}
