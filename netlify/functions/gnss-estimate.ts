import type { Config } from "@netlify/functions";
import type { GnssEstimateRequest, GnssEstimateResponse } from "../../packages/weather-domain/src";
import { CACHE_TTLS, getCacheState, setCached } from "./_shared/cache";
import { fetchGnssEstimate } from "./_shared/gnss";

function createGnssCacheKey(request: GnssEstimateRequest) {
  return [
    "gnss-estimate",
    request.location.latitude.toFixed(3),
    request.location.longitude.toFixed(3),
    request.environment,
    Math.round(request.weather.cloudCover),
    Math.round(request.weather.visibilityMeters / 500),
    Math.round(request.weather.precipitationProbability / 5),
    Math.round(request.weather.precipitationSum * 2),
    Math.round(request.weather.windGusts / 2),
  ].join(":");
}

export default async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const payload = (await req.json()) as GnssEstimateRequest;
    const cacheKey = createGnssCacheKey(payload);
    const cached = getCacheState<GnssEstimateResponse>(cacheKey);
    if (cached.state === "fresh") {
      console.info(`[weather-api] gnss cache=fresh ${cacheKey}`);
      return Response.json(cached.value);
    }

    const response = await fetchGnssEstimate(payload);
    if (response.dataStatus === "available") {
      setCached(cacheKey, response, CACHE_TTLS.gnssEstimate);
      console.info(`[weather-api] gnss cache=${cached.state} refreshed ${cacheKey}`);
      return Response.json(response);
    }

    if (cached.state === "stale" && cached.value.dataStatus === "available") {
      console.info(`[weather-api] gnss cache=stale fallback ${cacheKey}`);
      return Response.json(cached.value);
    }

    console.info(`[weather-api] gnss cache=${cached.state} unavailable ${cacheKey}`);
    return Response.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "GNSS estimate is unavailable right now.";
    return Response.json({ error: message }, { status: 500 });
  }
};

export const config: Config = {
  path: ["/api/gnss/estimate", "/api/v1/gnss/estimate"],
  method: "POST",
};
