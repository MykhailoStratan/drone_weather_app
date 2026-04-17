import type { Config } from "@netlify/functions";
import type { LocationOption } from "../../packages/weather-domain/src/types";
import { CACHE_TTLS, createWeatherCacheKey, getCached, setCached } from "./_shared/cache";
import { fetchWeatherFromProvider } from "./_shared/weather";
import type { WeatherPayload } from "../../packages/weather-domain/src";

export default async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const location = (await req.json()) as LocationOption;
    const cacheKey = createWeatherCacheKey("legacy-weather", location);
    const cached = getCached<WeatherPayload>(cacheKey);
    if (cached) {
      return Response.json(cached);
    }

    const payload = await fetchWeatherFromProvider(location);
    setCached(cacheKey, payload, CACHE_TTLS.legacyWeather);
    return Response.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Weather data is unavailable right now.";
    return Response.json({ error: message }, { status: 500 });
  }
};

export const config: Config = {
  path: "/api/weather",
  method: "POST",
};
