/**
 * Hand-maintained TypeScript bindings for property_registry contract events.
 * Mirrors contract/contracts/property_registry/src/events.rs.
 * Regenerated when event payloads change; keep in sync with check-all.sh builds.
 */

export type PropertyVisibility = 'listed' | 'unlisted' | 'draft' | 'rented';

export interface PropertyRegisteredEvent {
  topic: 'prop_reg';
  landlord: string;
  property_id: string;
  metadata_hash: string;
}

/** Discovery visibility signal consumed by the backend search indexer. */
export interface PropertyListedEvent {
  topic: 'prop_listed';
  landlord: string;
  property_id: string;
  visibility: PropertyVisibility;
}

export interface PropertyUnlistedEvent {
  topic: 'prop_unlisted';
  landlord: string;
  property_id: string;
  visibility: PropertyVisibility;
}

export interface PropertyVerifiedEvent {
  topic: 'prop_ver';
  admin: string;
  property_id: string;
}

export type PropertyRegistryEvent =
  | PropertyRegisteredEvent
  | PropertyListedEvent
  | PropertyUnlistedEvent
  | PropertyVerifiedEvent;
