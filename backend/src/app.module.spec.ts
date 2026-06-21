import { getRateLimitThrottlerOptions } from './common/config/rate-limit-options';

describe('getRateLimitThrottlerOptions', () => {
  it('uses documented defaults when rate-limit env vars are unset', () => {
    expect(getRateLimitThrottlerOptions({})).toEqual([
      { name: 'default', ttl: 60000, limit: 100 },
      { name: 'auth', ttl: 60000, limit: 5 },
      { name: 'strict', ttl: 60000, limit: 10 },
    ]);
  });

  it('parses explicit positive integer rate-limit env vars', () => {
    expect(
      getRateLimitThrottlerOptions({
        RATE_LIMIT_TTL: '120000',
        RATE_LIMIT_MAX: '200',
        RATE_LIMIT_AUTH_TTL: '30000',
        RATE_LIMIT_AUTH_MAX: '8',
        RATE_LIMIT_STRICT_TTL: '15000',
        RATE_LIMIT_STRICT_MAX: '3',
      }),
    ).toEqual([
      { name: 'default', ttl: 120000, limit: 200 },
      { name: 'auth', ttl: 30000, limit: 8 },
      { name: 'strict', ttl: 15000, limit: 3 },
    ]);
  });

  it('fails fast when a rate-limit env var is non-numeric', () => {
    expect(() =>
      getRateLimitThrottlerOptions({
        RATE_LIMIT_TTL: 'not-a-number',
      }),
    ).toThrow('RATE_LIMIT_TTL must be a positive integer');
  });

  it('fails fast when a rate-limit env var is not positive', () => {
    expect(() =>
      getRateLimitThrottlerOptions({
        RATE_LIMIT_MAX: '0',
      }),
    ).toThrow('RATE_LIMIT_MAX must be a positive integer');
  });
});
