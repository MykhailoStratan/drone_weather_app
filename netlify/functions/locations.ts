import type { Config } from "@netlify/functions";
import { validateLocationSearchQuery } from "../../packages/weather-domain/src/location-search";
import { CACHE_TTLS, createSearchCacheKey, getCacheState, setCached } from "./_shared/cache";
import { withCacheFallback } from "./_shared/handler";
import { checkRateLimit } from "./_shared/rateLimit";
import { searchLocationsFromProvider } from "./_shared/weather";

export default async (req: Request) => {
  const ip =
    req.headers.get("x-nf-client-connection-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown";

  const { allowed, retryAfterMs } = checkRateLimit(`locations:${ip}`);
  if (!allowed) {
    return new Response("Too Many Requests", {
      status: 429,
      headers: {
        "Retry-After": String(Math.ceil(retryAfterMs / 1000)),
      },
    });
  }

  const url = new URL(req.url);
  const validation = validateLocationSearchQuery(url.searchParams.get("query") ?? "");
  const query = validation.normalized;

  if (!query) {
    return Response.json([]);
  }

  if (!validation.valid) {
    return Response.json({ error: "Invalid location query." }, { status: 400 });
  }

  const cacheKey = createSearchCacheKey(query);

  try {
    return await withCacheFallback<Awaited<ReturnType<typeof searchLocationsFromProvider>>>(
      cacheKey,
      "locations",
      async () => {
        const cached = getCacheState<Awaited<ReturnType<typeof searchLocationsFromProvider>>>(cacheKey);
        if (cached.state === "fresh") {
          console.info(`[weather-api] locations cache=fresh query="${query}"`);
          return Response.json(cached.value);
        }

        const locations = await searchLocationsFromProvider(query);
        setCached(cacheKey, locations, CACHE_TTLS.locations);
        console.info(`[weather-api] locations cache=${cached.state} query="${query}" loaded=${locations.length}`);
        return Response.json(locations);
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to search locations.";
    return Response.json({ error: message }, { status: 500 });
  }
};

export const config: Config = {
  path: ["/api/locations", "/api/v1/locations"],
  method: "GET",
};
