#![no_std]

pub mod errors;
mod profile;
mod storage;
mod types;

#[cfg(test)]
mod tests_profile_management;

pub use errors::UserProfileError;
pub use profile::*;
pub use types::*;
