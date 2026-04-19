import type { Config } from "@netlify/functions";
import { getCacheState, setCached } from "./_shared/cache";
import { fetchNearbyAirspace, fetchNearbyTFRs } from "./_shared/airspace";
import type { AirspaceResponse } from "../../packages/weather-domain/src/types";

const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours — airports don't move
const TFR_CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes — TFRs change frequently

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

  const featuresCacheKey = `airspace:${lat.toFixed(2)}:${lng.toFixed(2)}`;
  const tfrCacheKey = `tfr:${lat.toFixed(1)}:${lng.toFixed(1)}`;

  const featuresCached = getCacheState<AirspaceResponse["features"]>(featuresCacheKey);
  const tfrCached = getCacheState<AirspaceResponse["tfrs"]>(tfrCacheKey);

  if (featuresCached.state === "fresh" && tfrCached.state === "fresh") {
    console.info(`[airspace] cache=fresh ${featuresCacheKey}`);
    const response: AirspaceResponse = {
      latitude: lat,
      longitude: lng,
      fetchedAt: new Date().toISOString(),
      features: featuresCached.value,
      tfrs: tfrCached.value,
    };
    return Response.json(response);
  }

  try {
    const [features, tfrs] = await Promise.all([
      featuresCached.state === "fresh"
        ? Promise.resolve(featuresCached.value)
        : fetchNearbyAirspace(lat, lng),
      tfrCached.state === "fresh"
        ? Promise.resolve(tfrCached.value)
        : fetchNearbyTFRs(lat, lng),
    ]);

    if (featuresCached.state !== "fresh") {
      setCached(featuresCacheKey, features, CACHE_TTL_MS);
    }
    if (tfrCached.state !== "fresh") {
      setCached(tfrCacheKey, tfrs, TFR_CACHE_TTL_MS);
    }

    const response: AirspaceResponse = {
      latitude: lat,
      longitude: lng,
      fetchedAt: new Date().toISOString(),
      features,
      tfrs,
    };
    console.info(`[airspace] refreshed ${featuresCacheKey} — ${features.length} features, ${tfrs.length} TFRs`);
    return Response.json(response);
  } catch (error) {
    if (featuresCached.state === "stale") {
      console.warn(`[airspace] stale fallback ${featuresCacheKey}`);
      const response: AirspaceResponse = {
        latitude: lat,
        longitude: lng,
        fetchedAt: new Date().toISOString(),
        features: featuresCached.value,
        tfrs: tfrCached.state === "stale" ? tfrCached.value : [],
      };
      return Response.json(response, { headers: { "x-skycanvas-cache": "stale" } });
    }
    const message = error instanceof Error ? error.message : "Airspace data is unavailable right now.";
    return Response.json({ error: message }, { status: 500 });
  }
};

export const config: Config = {
  path: ["/api/v1/airspace"],
  method: "GET",
};
