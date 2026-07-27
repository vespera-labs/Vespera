export type ListingVisibility = "listed" | "unlisted" | "draft" | "rented";

export interface Property {
  id: string;
  title: string;
  location: string;
  rentPerMonth: number;
  deposit: number;
  leaseMonths: number;
  /** Lease/dispute status for dashboard surfaces. */
  status: "active" | "disputed";
  /** Discovery visibility — present on both mock and live search results. */
  visibility: ListingVisibility;
}

export interface SearchListing {
  id: string;
  title: string;
  city: string;
  state?: string;
  country?: string;
  price: number;
  bedrooms: number;
  bathrooms: number;
  visibility: ListingVisibility;
  tenant_id?: string;
}

export interface SearchListingsResult {
  hits: SearchListing[];
  total: number;
  page: number;
  limit: number;
}

export interface DashboardData {
  activeLeases: number;
  dueThisMonth: number;
  escrowed: number;
  recent: Payment[];
}

export interface Payment {
  id: string;
  property: string;
  date: string;
  amount: number;
  txHash: string;
}

export const mockProperties: Property[] = [
  {
    id: "p1",
    title: "2BR loft, Yaba",
    location: "Lagos, Nigeria",
    rentPerMonth: 320,
    deposit: 640,
    leaseMonths: 12,
    status: "active",
    visibility: "listed",
  },
  {
    id: "p2",
    title: "Studio, Westlands",
    location: "Nairobi, Kenya",
    rentPerMonth: 180,
    deposit: 360,
    leaseMonths: 6,
    status: "disputed",
    visibility: "listed",
  },
  {
    id: "p3",
    title: "3BR house, Sandton",
    location: "Johannesburg, South Africa",
    rentPerMonth: 540,
    deposit: 1080,
    leaseMonths: 12,
    status: "active",
    visibility: "listed",
  },
];

const mockPayments: Payment[] = [
  {
    id: "r1",
    property: "2BR loft, Yaba",
    date: "2026-05-01",
    amount: 320,
    txHash: "abcd1234abcd1234abcd1234abcd1234",
  },
  {
    id: "r2",
    property: "Studio, Westlands",
    date: "2026-05-01",
    amount: 180,
    txHash: "efgh5678efgh5678efgh5678efgh5678",
  },
  {
    id: "r3",
    property: "2BR loft, Yaba",
    date: "2026-04-01",
    amount: 320,
    txHash: "ijkl9012ijkl9012ijkl9012ijkl9012",
  },
];

const mockDashboard: DashboardData = {
  activeLeases: 2,
  dueThisMonth: 500,
  escrowed: 1000,
  recent: mockPayments,
};

function simulateFetch<T>(data: T, delayMs = 300): Promise<T> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(data), delayMs);
  });
}

export async function fetchDashboardData(): Promise<DashboardData> {
  return simulateFetch({ ...mockDashboard, recent: [...mockDashboard.recent] });
}

export async function fetchProperties(): Promise<Property[]> {
  return simulateFetch([...mockProperties]);
}

export async function fetchPayments(): Promise<Payment[]> {
  return simulateFetch([...mockPayments]);
}

/** Mock scoped search — only listed visibility is returned. */
export async function fetchSearchListings(filters: {
  q?: string;
  city?: string;
  minPrice?: number;
  maxPrice?: number;
  bedrooms?: number;
}): Promise<SearchListingsResult> {
  let hits: SearchListing[] = mockProperties
    .filter((p) => p.visibility === "listed")
    .map((p) => ({
      id: p.id,
      title: p.title,
      city: p.location.split(",")[0]?.trim() ?? p.location,
      price: p.rentPerMonth,
      bedrooms: 2,
      bathrooms: 1,
      visibility: p.visibility,
    }));

  if (filters.q) {
    const q = filters.q.toLowerCase();
    hits = hits.filter((h) => h.title.toLowerCase().includes(q));
  }
  if (filters.city) {
    const city = filters.city.toLowerCase();
    hits = hits.filter((h) => h.city.toLowerCase().includes(city));
  }
  if (filters.minPrice !== undefined) {
    hits = hits.filter((h) => h.price >= filters.minPrice!);
  }
  if (filters.maxPrice !== undefined) {
    hits = hits.filter((h) => h.price <= filters.maxPrice!);
  }

  return simulateFetch({ hits, total: hits.length, page: 1, limit: 20 });
}
