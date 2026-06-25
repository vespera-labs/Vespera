// FIX #33: LockService must fail closed when Redis is unavailable
// Bug: localLockMap fallback gives no cross-instance protection
// Fix: Reject financial lock requests when Redis unavailable

import { Injectable, Logger } from "@nestjs/common";
import { Redis } from "ioredis";

export class DistributedLockError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DistributedLockError";
  }
}

@Injectable()
export class LockService {
  private readonly logger = new Logger(LockService.name);
  private redis: Redis | null;

  constructor(redis: Redis | null) {
    this.redis = redis;
  }

  async acquireLock(key: string, ttlMs: number = 30000, failClosed: boolean = true): Promise<string | null> {
    if (!this.redis) {
      if (failClosed) {
        this.logger.error("FAIL-CLOSED: Redis unavailable, rejecting lock for: " + key);
        throw new DistributedLockError("Cannot acquire distributed lock: Redis unavailable (key=" + key + ")");
      }
      return crypto.randomUUID();
    }
    const lockId = crypto.randomUUID();
    const result = await this.redis.set("lock:" + key, lockId, "PX", ttlMs, "NX");
    return result === "OK" ? lockId : null;
  }

  async releaseLock(key: string, lockId: string): Promise<boolean> {
    if (!this.redis) return true;
    const script = "if redis.call(\"get\",KEYS[1])==ARGV[1] then return redis.call(\"del\",KEYS[1]) else return 0 end";
    const result = await this.redis.eval(script, 1, "lock:" + key, lockId);
    return result === 1;
  }
}
