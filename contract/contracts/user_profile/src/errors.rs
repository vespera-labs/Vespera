use soroban_sdk::contracterror;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum UserProfileError {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    ProfileAlreadyExists = 3,
    ProfileNotFound = 4,
    InvalidDataHash = 5,
    Unauthorized = 6,
    AdminNotConfigured = 7,
    KycNotVerified = 8,
    ScreeningNotClear = 9,
    InvalidKycStatusTransition = 10,
    InvalidScreeningStatusTransition = 11,
    KycAuthorityNotConfigured = 12,
}
