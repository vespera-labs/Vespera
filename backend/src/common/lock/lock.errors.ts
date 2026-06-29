export class LockNotAcquiredError extends Error {
  constructor(message = "Could not acquire lock within the retry window") {
    super(message);
    this.name = "LockNotAcquiredError";
  }
}

export class RedisUnavailableError extends Error {
  constructor(
    message = "Redis is unavailable and distributed lock is required",
  ) {
    super(message);
    this.name = "RedisUnavailableError";
  }
}
