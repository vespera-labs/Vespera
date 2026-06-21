const RATE_LIMIT_DEFAULTS = {
  RATE_LIMIT_TTL: 60_000,
  RATE_LIMIT_MAX: 100,
  RATE_LIMIT_AUTH_TTL: 60_000,
  RATE_LIMIT_AUTH_MAX: 5,
  RATE_LIMIT_STRICT_TTL: 60_000,
  RATE_LIMIT_STRICT_MAX: 10,
} as const;

function parseRateLimitEnv(
  env: NodeJS.ProcessEnv,
  key: keyof typeof RATE_LIMIT_DEFAULTS,
): number {
  const rawValue = env[key];

  if (rawValue === undefined || rawValue === '') {
    return RATE_LIMIT_DEFAULTS[key];
  }

  const value = Number(rawValue);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(
      `${key} must be a positive integer number of milliseconds/requests`,
    );
  }

  return value;
}

export function getRateLimitThrottlerOptions(env = process.env) {
  return [
    {
      name: 'default',
      ttl: parseRateLimitEnv(env, 'RATE_LIMIT_TTL'),
      limit: parseRateLimitEnv(env, 'RATE_LIMIT_MAX'),
    },
    {
      name: 'auth',
      ttl: parseRateLimitEnv(env, 'RATE_LIMIT_AUTH_TTL'),
      limit: parseRateLimitEnv(env, 'RATE_LIMIT_AUTH_MAX'),
    },
    {
      name: 'strict',
      ttl: parseRateLimitEnv(env, 'RATE_LIMIT_STRICT_TTL'),
      limit: parseRateLimitEnv(env, 'RATE_LIMIT_STRICT_MAX'),
    },
  ];
}
