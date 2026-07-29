export enum KycStatus {
  UNVERIFIED = 'UNVERIFIED',
  PENDING = 'PENDING',
  VERIFIED = 'VERIFIED',
  REJECTED = 'REJECTED',
  // Legacy values (kept for backward compatibility, map to new values)
  APPROVED = 'APPROVED',
  NEEDS_INFO = 'NEEDS_INFO',
}

export enum ScreeningStatus {
  CLEAR = 'CLEAR',
  FLAGGED = 'FLAGGED',
  BLOCKED = 'BLOCKED',
}
