import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import type { SearchListingsResult } from "@/lib/mock";
import { fetchSearchListings } from "@/lib/mock";

export const dynamic = "force-dynamic";

const BACKEND_URL =
  process.env.BACKEND_API_URL || process.env.API_URL || "http://localhost:3000";

/**
 * BFF search route.
 * Tenant identity is derived from the server-side session/JWT cookie.
 * Client-supplied tenantId / visibility overrides are dropped.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  // Drop client scope overrides — never forward to the backend.
  const userFacing = {
    q: searchParams.get("q") ?? undefined,
    city: searchParams.get("city") ?? undefined,
    minPrice: searchParams.get("minPrice") ?? undefined,
    maxPrice: searchParams.get("maxPrice") ?? undefined,
    bedrooms: searchParams.get("bedrooms") ?? undefined,
    page: searchParams.get("page") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
  };

  const cookieStore = await cookies();
  const accessToken =
    cookieStore.get("access_token")?.value ||
    cookieStore.get("token")?.value ||
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  if (!accessToken) {
    // Dev/mock fallback when no session — still never trusts client tenantId.
    const mock = await fetchSearchListings({
      q: userFacing.q,
      city: userFacing.city,
      minPrice: userFacing.minPrice
        ? parseFloat(userFacing.minPrice)
        : undefined,
      maxPrice: userFacing.maxPrice
        ? parseFloat(userFacing.maxPrice)
        : undefined,
      bedrooms: userFacing.bedrooms
        ? parseInt(userFacing.bedrooms, 10)
        : undefined,
    });
    return NextResponse.json(mock);
  }

  const upstream = new URLSearchParams();
  for (const [key, value] of Object.entries(userFacing)) {
    if (value !== undefined && value !== "") {
      upstream.set(key, value);
    }
  }

  try {
    const response = await fetch(
      `${BACKEND_URL}/search/listings?${upstream.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
        },
        cache: "no-store",
      },
    );

    if (!response.ok) {
      const text = await response.text();
      return NextResponse.json(
        { error: "Search upstream failed", detail: text },
        { status: response.status },
      );
    }

    const data = (await response.json()) as SearchListingsResult;
    return NextResponse.json(data);
  } catch {
    // Backend unreachable — mock with listed-only results.
    const mock = await fetchSearchListings({
      q: userFacing.q,
      city: userFacing.city,
      minPrice: userFacing.minPrice
        ? parseFloat(userFacing.minPrice)
        : undefined,
      maxPrice: userFacing.maxPrice
        ? parseFloat(userFacing.maxPrice)
        : undefined,
      bedrooms: userFacing.bedrooms
        ? parseInt(userFacing.bedrooms, 10)
        : undefined,
    });
    return NextResponse.json(mock);
  }
}
