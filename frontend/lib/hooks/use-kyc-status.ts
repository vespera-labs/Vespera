"use client";

import { useQuery } from "@tanstack/react-query";

export type KycStatus = "UNVERIFIED" | "PENDING" | "VERIFIED" | "REJECTED";
export type ScreeningStatus = "CLEAR" | "FLAGGED" | "BLOCKED";

export interface KycStatusData {
  kyc: KycStatus;
  screening: ScreeningStatus;
}

const DEFAULT_STATUS: KycStatusData = {
  kyc: "UNVERIFIED",
  screening: "CLEAR",
};

export function useKycStatus() {
  return useQuery({
    queryKey: ["kyc-status"],
    queryFn: async (): Promise<KycStatusData> => {
      try {
        const res = await fetch("/api/v1/kyc/status");
        if (!res.ok) return DEFAULT_STATUS;
        const data = await res.json();
        return {
          kyc: data.kycStatus ?? data.kyc ?? "UNVERIFIED",
          screening: data.screeningStatus ?? data.screening ?? "CLEAR",
        };
      } catch {
        return DEFAULT_STATUS;
      }
    },
    staleTime: 60_000,
  });
}

export function isCleared(status: KycStatusData | undefined): boolean {
  if (!status) return false;
  return status.kyc === "VERIFIED" && status.screening === "CLEAR";
}
