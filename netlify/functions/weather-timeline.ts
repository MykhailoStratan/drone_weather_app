import type { Config } from "@netlify/functions";
import { CACHE_TTLS, createWeatherCacheKey, getCacheState, setCached } from "./_shared/cache";
import { createTimelineResponse, parseWeatherQuery, toWeatherQuery } from "./_shared/contracts";
import { withCacheFallback } from "./_shared/handler";
import { fetchTimelineBundle } from "./_shared/provider";
import type { WeatherTimelineResponse } from "../../packages/weather-domain/src";

export default async (req: Request) => {
  if (req.method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }

  const query = toWeatherQuery(parseWeatherQuery(new URL(req.url)));
  const cacheKey = createWeatherCacheKey("timeline", query);

  try {
    return await withCacheFallback<WeatherTimelineResponse>(cacheKey, "timeline", async () => {
      const cached = getCacheState<WeatherTimelineResponse>(cacheKey);
      if (cached.state === "fresh") {
        console.info(`[weather-api] timeline cache=fresh ${cacheKey}`);
        return Response.json(cached.value);
      }

      const forecast = await fetchTimelineBundle(query);
      const response = createTimelineResponse({
        location: query,
        timezone: forecast.timezone,
        latitude: forecast.latitude,
        longitude: forecast.longitude,
        hourly: forecast.hourly,
        daily: forecast.daily,
      });
      setCached(cacheKey, response, CACHE_TTLS.timeline);
      console.info(`[weather-api] timeline cache=${cached.state} refreshed ${cacheKey}`);
      return Response.json(response);
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Weather timeline is unavailable right now.";
    return Response.json({ error: message }, { status: 500 });
  }
};

export const config: Config = {
  path: ["/api/weather/timeline", "/api/v1/weather/timeline"],
  method: "GET",
};
