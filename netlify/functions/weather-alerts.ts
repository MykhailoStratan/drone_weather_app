import type { Config } from "@netlify/functions";
import { CACHE_TTLS, createWeatherCacheKey, getCacheState, setCached } from "./_shared/cache";
import { createAlertsResponse, parseWeatherQuery, toWeatherQuery } from "./_shared/contracts";
import { fetchUnitedStatesAlerts } from "./_shared/provider";
import type { WeatherAlertsResponse } from "../../packages/weather-domain/src";

export default async (req: Request) => {
  if (req.method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const query = toWeatherQuery(parseWeatherQuery(new URL(req.url)));
    const cacheKey = createWeatherCacheKey("alerts", query);
    const cached = getCacheState<WeatherAlertsResponse>(cacheKey);
    if (cached.state === "fresh") {
      console.info(`[weather-api] alerts cache=fresh ${cacheKey}`);
      return Response.json(cached.value);
    }

    const alerts = await fetchUnitedStatesAlerts(query);
    const response = createAlertsResponse({
      location: query,
      timezone: query.timezone ?? "auto",
      latitude: query.latitude,
      longitude: query.longitude,
      alerts,
    });
    setCached(cacheKey, response, CACHE_TTLS.alerts);
    console.info(`[weather-api] alerts cache=${cached.state} refreshed ${cacheKey} count=${alerts.length}`);
    return Response.json(response);
  } catch (error) {
    const query = toWeatherQuery(parseWeatherQuery(new URL(req.url)));
    const cacheKey = createWeatherCacheKey("alerts", query);
    const cached = getCacheState<WeatherAlertsResponse>(cacheKey);
    if (cached.state === "stale") {
      console.warn(`[weather-api] alerts cache=stale-fallback ${cacheKey}`);
      return Response.json(cached.value, {
        headers: {
          "x-skycanvas-cache": "stale",
        },
      });
    }

    console.warn("[weather-api] alerts degraded to empty list", error);
    return Response.json(
      createAlertsResponse({
        location: query,
        timezone: query.timezone ?? "auto",
        latitude: query.latitude,
        longitude: query.longitude,
        alerts: [],
      }),
      {
        headers: {
          "x-skycanvas-alerts": "degraded",
        },
      },
    );
  }
};

export const config: Config = {
  path: "/api/weather/alerts",
  method: "GET",
};
