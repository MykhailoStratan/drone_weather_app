import type { Config } from "@netlify/functions";
import { getCacheState, setCached } from "./_shared/cache";
import { fetchNearbyAirspace } from "./_shared/airspace";
import type { AirspaceResponse } from "../../packages/weather-domain/src/types";

const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours — airports don't move

export default async (req: Request) => {
  if (req.method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }

  const url = new URL(req.url);
  const lat = Number(url.searchParams.get("lat"));
  const lng = Number(url.searchParams.get("lng"));

  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return Response.json({ error: "lat and lng query params are required." }, { status: 400 });
  }

  const cacheKey = `airspace:${lat.toFixed(2)}:${lng.toFixed(2)}`;
  const cached = getCacheState<AirspaceResponse>(cacheKey);
  if (cached.state === "fresh") {
    console.info(`[airspace] cache=fresh ${cacheKey}`);
    return Response.json(cached.value);
  }

  try {
    const features = await fetchNearbyAirspace(lat, lng);
    const response: AirspaceResponse = {
      latitude: lat,
      longitude: lng,
      fetchedAt: new Date().toISOString(),
      features,
    };
    setCached(cacheKey, response, CACHE_TTL_MS);
    console.info(`[airspace] cache=${cached.state} refreshed ${cacheKey}`);
    return Response.json(response);
  } catch (error) {
    if (cached.state === "stale") {
      console.warn(`[airspace] stale fallback ${cacheKey}`);
      return Response.json(cached.value, { headers: { "x-skycanvas-cache": "stale" } });
    }
    const message = error instanceof Error ? error.message : "Airspace data is unavailable right now.";
    return Response.json({ error: message }, { status: 500 });
  }
};

export const config: Config = {
  path: ["/api/v1/airspace"],
  method: "GET",
};
