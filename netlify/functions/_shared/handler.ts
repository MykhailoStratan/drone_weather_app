import { getCacheState } from "./cache";

export async function withCacheFallback<T>(
  cacheKey: string,
  label: string,
  handler: () => Promise<Response>,
): Promise<Response> {
  try {
    return await handler();
  } catch (error) {
    const cached = getCacheState<T>(cacheKey);
    if (cached.state === "stale") {
      console.warn(`[weather-api] ${label} cache=stale-fallback ${cacheKey}`);
      return Response.json(cached.value, {
        headers: { "x-skycanvas-cache": "stale" },
      });
    }
    throw error;
  }
}
