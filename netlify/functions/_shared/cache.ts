type CacheEntry<T> = {
  expiresAt: number;
  value: T;
};

export type CacheState<T> =
  | { state: "miss"; value: null }
  | { state: "fresh"; value: T }
  | { state: "stale"; value: T };

const cacheStore = new Map<string, CacheEntry<unknown>>();

export function getCached<T>(key: string): T | null {
  const entry = cacheStore.get(key);
  if (!entry) {
    return null;
  }

  if (Date.now() > entry.expiresAt) {
    cacheStore.delete(key);
    return null;
  }

  return entry.value as T;
}

export function getCacheState<T>(key: string): CacheState<T> {
  const entry = cacheStore.get(key) as CacheEntry<T> | undefined;
  if (!entry) {
    return { state: "miss", value: null };
  }

  if (Date.now() > entry.expiresAt) {
    return { state: "stale", value: entry.value };
  }

  return { state: "fresh", value: entry.value };
}

export function setCached<T>(key: string, value: T, ttlMs: number) {
  cacheStore.set(key, {
    value,
    expiresAt: Date.now() + ttlMs,
  });
}

export function createWeatherCacheKey(scope: string, parts: {
  latitude: number;
  longitude: number;
  timezone?: string;
  country?: string;
}) {
  return [
    scope,
    parts.latitude.toFixed(4),
    parts.longitude.toFixed(4),
    parts.timezone ?? "auto",
    parts.country ?? "unknown",
  ].join(":");
}

export function createSearchCacheKey(query: string) {
  return `locations:${query.trim().toLowerCase()}`;
}

export const CACHE_TTLS = {
  overview: 5 * 60 * 1000,
  timeline: 10 * 60 * 1000,
  alerts: 2 * 60 * 1000,
  locations: 60 * 60 * 1000,
  legacyWeather: 5 * 60 * 1000,
  gnssEstimate: 10 * 60 * 1000,
  gnssConstellation: 60 * 60 * 1000,
  gnssSpaceWeather: 15 * 60 * 1000,
} as const;
