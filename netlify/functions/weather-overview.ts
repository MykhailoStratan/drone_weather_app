import type { Config } from "@netlify/functions";
import { CACHE_TTLS, createWeatherCacheKey, getCached, setCached } from "./_shared/cache";
import { createOverviewResponse, parseWeatherQuery, toWeatherQuery } from "./_shared/contracts";
import { fetchForecastBundle } from "./_shared/provider";
import type { WeatherOverviewResponse } from "../../packages/weather-domain/src";

export default async (req: Request) => {
  if (req.method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const query = toWeatherQuery(parseWeatherQuery(new URL(req.url)));
    const cacheKey = createWeatherCacheKey("overview", query);
    const cached = getCached<WeatherOverviewResponse>(cacheKey);
    if (cached) {
      return Response.json(cached);
    }

    const forecast = await fetchForecastBundle(query);
    const today = forecast.daily[7] ?? forecast.daily[0];
    const response = createOverviewResponse({
      location: query,
      timezone: forecast.timezone,
      latitude: forecast.latitude,
      longitude: forecast.longitude,
      current: forecast.current,
      today,
    });
    setCached(cacheKey, response, CACHE_TTLS.overview);
    return Response.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Weather overview is unavailable right now.";
    return Response.json({ error: message }, { status: 500 });
  }
};

export const config: Config = {
  path: "/api/weather/overview",
  method: "GET",
};
