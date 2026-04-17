import type { Config } from "@netlify/functions";
import { CACHE_TTLS, createSearchCacheKey, getCacheState, setCached } from "./_shared/cache";
import { searchLocationsFromProvider } from "./_shared/weather";

export default async (req: Request) => {
  const url = new URL(req.url);
  const query = url.searchParams.get("query")?.trim() ?? "";

  if (query.length < 2) {
    return Response.json([]);
  }

  try {
    const cacheKey = createSearchCacheKey(query);
    const cached = getCacheState<Awaited<ReturnType<typeof searchLocationsFromProvider>>>(cacheKey);
    if (cached.state === "fresh") {
      console.info(`[weather-api] locations cache=fresh query="${query}"`);
      return Response.json(cached.value);
    }

    const locations = await searchLocationsFromProvider(query);
    setCached(cacheKey, locations, CACHE_TTLS.locations);
    console.info(`[weather-api] locations cache=${cached.state} query="${query}" loaded=${locations.length}`);
    return Response.json(locations);
  } catch (error) {
    const cacheKey = createSearchCacheKey(query);
    const cached = getCacheState<Awaited<ReturnType<typeof searchLocationsFromProvider>>>(cacheKey);
    if (cached.state === "stale") {
      console.warn(`[weather-api] locations cache=stale-fallback query="${query}"`);
      return Response.json(cached.value, {
        headers: {
          "x-skycanvas-cache": "stale",
        },
      });
    }

    const message = error instanceof Error ? error.message : "Unable to search locations.";
    return Response.json({ error: message }, { status: 500 });
  }
};

export const config: Config = {
  path: ["/api/locations", "/api/v1/locations"],
  method: "GET",
};
