import type { Config } from "@netlify/functions";
import type { LocationOption } from "../../packages/weather-domain/src/types";
import { CACHE_TTLS, createWeatherCacheKey, getCacheState, setCached } from "./_shared/cache";
import { fetchWeatherFromProvider } from "./_shared/weather";
import type { WeatherPayload } from "../../packages/weather-domain/src";

export default async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const requestCopy = req.clone();

  try {
    const location = (await req.json()) as LocationOption;
    const cacheKey = createWeatherCacheKey("legacy-weather", location);
    const cached = getCacheState<WeatherPayload>(cacheKey);
    if (cached.state === "fresh") {
      console.info(`[weather-api] legacy cache=fresh ${cacheKey}`);
      return Response.json(cached.value);
    }

    const payload = await fetchWeatherFromProvider(location);
    setCached(cacheKey, payload, CACHE_TTLS.legacyWeather);
    console.info(`[weather-api] legacy cache=${cached.state} refreshed ${cacheKey}`);
    return Response.json(payload);
  } catch (error) {
    const location = (await requestCopy.json()) as LocationOption;
    const cacheKey = createWeatherCacheKey("legacy-weather", location);
    const cached = getCacheState<WeatherPayload>(cacheKey);
    if (cached.state === "stale") {
      console.warn(`[weather-api] legacy cache=stale-fallback ${cacheKey}`);
      return Response.json(cached.value, {
        headers: {
          "x-skycanvas-cache": "stale",
        },
      });
    }

    const message = error instanceof Error ? error.message : "Weather data is unavailable right now.";
    return Response.json({ error: message }, { status: 500 });
  }
};

export const config: Config = {
  path: "/api/weather",
  method: "POST",
};
