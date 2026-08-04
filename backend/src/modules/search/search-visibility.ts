import { ListingStatus } from '../properties/entities/property.entity';

/** ES document visibility discriminator (maps from ListingStatus). */
export enum SearchVisibility {
  LISTED = 'listed',
  UNLISTED = 'unlisted',
  DRAFT = 'draft',
  RENTED = 'rented',
}

export function listingStatusToVisibility(
  status: ListingStatus,
): SearchVisibility {
  switch (status) {
    case ListingStatus.PUBLISHED:
      return SearchVisibility.LISTED;
    case ListingStatus.ARCHIVED:
      return SearchVisibility.UNLISTED;
    case ListingStatus.DRAFT:
      return SearchVisibility.DRAFT;
    case ListingStatus.RENTED:
      return SearchVisibility.RENTED;
    default:
      return SearchVisibility.UNLISTED;
  }
}

export function visibilityToListingStatus(
  visibility: SearchVisibility,
): ListingStatus {
  switch (visibility) {
    case SearchVisibility.LISTED:
      return ListingStatus.PUBLISHED;
    case SearchVisibility.UNLISTED:
      return ListingStatus.ARCHIVED;
    case SearchVisibility.DRAFT:
      return ListingStatus.DRAFT;
    case SearchVisibility.RENTED:
      return ListingStatus.RENTED;
    default:
      return ListingStatus.ARCHIVED;
  }
}
