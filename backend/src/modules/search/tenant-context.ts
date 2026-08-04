import { SearchVisibility } from './search-visibility';

/**
 * Server-derived search scope. Never construct from request query/body params.
 */
export interface TenantContext {
  /** Landlord/org tenant identity from the authenticated principal. */
  tenantId: string;
  /** Visibility values the caller is allowed to see. */
  allowedVisibilities: SearchVisibility[];
}

export function discoveryTenantContext(tenantId: string): TenantContext {
  return {
    tenantId,
    allowedVisibilities: [SearchVisibility.LISTED],
  };
}

export function landlordTenantContext(tenantId: string): TenantContext {
  return {
    tenantId,
    allowedVisibilities: [
      SearchVisibility.LISTED,
      SearchVisibility.UNLISTED,
      SearchVisibility.DRAFT,
      SearchVisibility.RENTED,
    ],
  };
}
