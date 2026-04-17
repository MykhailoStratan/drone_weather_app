import type { Config } from "@netlify/functions";
import { CACHE_TTLS, createWeatherCacheKey, getCached, setCached } from "./_shared/cache";
import { createAlertsResponse, parseWeatherQuery, toWeatherQuery } from "./_shared/contracts";
import { fetchForecastBundle, fetchUnitedStatesAlerts } from "./_shared/provider";
import type { WeatherAlertsResponse } from "../../packages/weather-domain/src";

export default async (req: Request) => {
  if (req.method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const query = toWeatherQuery(parseWeatherQuery(new URL(req.url)));
    const cacheKey = createWeatherCacheKey("alerts", query);
    const cached = getCached<WeatherAlertsResponse>(cacheKey);
    if (cached) {
      return Response.json(cached);
    }

    const [forecast, alerts] = await Promise.all([
      fetchForecastBundle(query),
      fetchUnitedStatesAlerts(query),
    ]);
    const response = createAlertsResponse({
      location: query,
      timezone: forecast.timezone,
      latitude: forecast.latitude,
      longitude: forecast.longitude,
      alerts,
    });
    setCached(cacheKey, response, CACHE_TTLS.alerts);
    return Response.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Weather alerts are unavailable right now.";
    return Response.json({ error: message }, { status: 500 });
  }
};

export const config: Config = {
  path: "/api/weather/alerts",
  method: "GET",
};
