"use client";

import { useKycStatus, isCleared } from "@/lib/hooks/use-kyc-status";

interface KycClearedGateProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * Renders children only when the user's KYC status is Verified
 * and screening status is Clear. Shows a clearance-required
 * message otherwise.
 */
export function KycClearedGate({ children, fallback }: KycClearedGateProps) {
  const { data: status, isLoading } = useKycStatus();

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-ink/10 p-6 text-center">
        <p className="text-sm text-ink-muted">Checking verification status...</p>
      </div>
    );
  }

  if (isCleared(status)) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
      <h3 className="font-medium text-amber-800">Identity verification required</h3>
      <p className="mt-1 text-sm text-amber-700">
        You need to complete KYC verification and pass screening before you can
        perform this action. Please complete your identity verification in your
        account settings.
      </p>
    </div>
  );
}
