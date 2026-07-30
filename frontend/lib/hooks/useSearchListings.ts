"use client";

import { useQuery } from "@tanstack/react-query";
import type { SearchListingsResult } from "@/lib/mock";

export interface SearchListingsFilters {
  q?: string;
  city?: string;
  minPrice?: number;
  maxPrice?: number;
  bedrooms?: number;
  page?: number;
  limit?: number;
}

/**
 * Forwards only user-facing filters. Never sends tenantId or visibility —
 * those are derived server-side in the BFF from the session.
 */
export function useSearchListings(filters: SearchListingsFilters = {}) {
  return useQuery({
    queryKey: ["search-listings", filters],
    queryFn: async (): Promise<SearchListingsResult> => {
      const params = new URLSearchParams();
      if (filters.q) params.set("q", filters.q);
      if (filters.city) params.set("city", filters.city);
      if (filters.minPrice !== undefined)
        params.set("minPrice", String(filters.minPrice));
      if (filters.maxPrice !== undefined)
        params.set("maxPrice", String(filters.maxPrice));
      if (filters.bedrooms !== undefined)
        params.set("bedrooms", String(filters.bedrooms));
      if (filters.page !== undefined) params.set("page", String(filters.page));
      if (filters.limit !== undefined)
        params.set("limit", String(filters.limit));

      const response = await fetch(`/api/search?${params.toString()}`);
      if (!response.ok) {
        throw new Error(`Search failed: ${response.status}`);
      }
      return response.json() as Promise<SearchListingsResult>;
    },
  });
}
