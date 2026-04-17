import type { Config } from "@netlify/functions";
import { CACHE_TTLS, createWeatherCacheKey, getCacheState, setCached } from "./_shared/cache";
import { createOverviewResponse, parseWeatherQuery, toWeatherQuery } from "./_shared/contracts";
import { fetchOverviewBundle } from "./_shared/provider";
import type { WeatherOverviewResponse } from "../../packages/weather-domain/src";

export default async (req: Request) => {
  if (req.method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const query = toWeatherQuery(parseWeatherQuery(new URL(req.url)));
    const cacheKey = createWeatherCacheKey("overview", query);
    const cached = getCacheState<WeatherOverviewResponse>(cacheKey);
    if (cached.state === "fresh") {
      console.info(`[weather-api] overview cache=fresh ${cacheKey}`);
      return Response.json(cached.value);
    }

    const forecast = await fetchOverviewBundle(query);
    const response = createOverviewResponse({
      location: query,
      timezone: forecast.timezone,
      latitude: forecast.latitude,
      longitude: forecast.longitude,
      current: forecast.current,
      today: forecast.today,
    });
    setCached(cacheKey, response, CACHE_TTLS.overview);
    console.info(`[weather-api] overview cache=${cached.state} refreshed ${cacheKey}`);
    return Response.json(response);
  } catch (error) {
    const query = toWeatherQuery(parseWeatherQuery(new URL(req.url)));
    const cacheKey = createWeatherCacheKey("overview", query);
    const cached = getCacheState<WeatherOverviewResponse>(cacheKey);
    if (cached.state === "stale") {
      console.warn(`[weather-api] overview cache=stale-fallback ${cacheKey}`);
      return Response.json(cached.value, {
        headers: {
          "x-skycanvas-cache": "stale",
        },
      });
    }

    const message = error instanceof Error ? error.message : "Weather overview is unavailable right now.";
    return Response.json({ error: message }, { status: 500 });
  }
};

export const config: Config = {
  path: "/api/weather/overview",
  method: "GET",
};
