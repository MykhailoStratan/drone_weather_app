import type { Config } from "@netlify/functions";
import { getCacheState, setCached } from "./_shared/cache";
import { fetchNearbyAirspace, fetchNearbyTFRs } from "./_shared/airspace";
import type { AirspaceResponse } from "../../packages/weather-domain/src/types";

const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours - airports do not move
const TFR_CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes - TFRs change frequently
const CACHE_COORD_PRECISION = 4;

function parseCoordinate(value: string | null, label: "lat" | "lng") {
  if (value === null || value.trim() === "") {
    return {
      error: Response.json({ error: "lat and lng query params are required." }, { status: 400 }),
      value: null,
    };
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return {
      error: Response.json({ error: `${label} must be a valid number.` }, { status: 400 }),
      value: null,
    };
  }

  const inRange =
    label === "lat" ? parsed >= -90 && parsed <= 90 : parsed >= -180 && parsed <= 180;
  if (!inRange) {
    return {
      error: Response.json({ error: `${label} is out of range.` }, { status: 400 }),
      value: null,
    };
  }

  return { error: null, value: parsed };
}

function airspaceCacheKey(lat: number, lng: number) {
  return `airspace:${lat.toFixed(CACHE_COORD_PRECISION)}:${lng.toFixed(CACHE_COORD_PRECISION)}`;
}

export default async (req: Request) => {
  if (req.method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }

  const url = new URL(req.url);
  const latResult = parseCoordinate(url.searchParams.get("lat"), "lat");
  if (latResult.error) {
    return latResult.error;
  }

  const lngResult = parseCoordinate(url.searchParams.get("lng"), "lng");
  if (lngResult.error) {
    return lngResult.error;
  }

  const lat = latResult.value;
  const lng = lngResult.value;
  const featuresCacheKey = airspaceCacheKey(lat, lng);
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
    console.info(`[airspace] refreshed ${featuresCacheKey} - ${features.length} features, ${tfrs.length} TFRs`);
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
