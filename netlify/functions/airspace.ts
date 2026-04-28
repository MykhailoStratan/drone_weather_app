import type { Config } from "@netlify/functions";
import { getCacheState, setCached } from "./_shared/cache";
import { withCors } from "./_shared/cors";
import { fetchAirspaceBundle } from "./_shared/airspace";
import type { AirspaceBundle } from "./_shared/airspace";
import type { AirspaceResponse } from "../../packages/weather-domain/src/types";

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const TFR_CACHE_TTL_MS = 15 * 60 * 1000;
const CACHE_COORD_PRECISION = 5;

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

function cacheKey(lat: number, lng: number, country: string) {
  return `airspace:v4:${country}:${lat.toFixed(CACHE_COORD_PRECISION)}:${lng.toFixed(CACHE_COORD_PRECISION)}`;
}

export default withCors(async (req: Request) => {
  if (req.method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }

  const url = new URL(req.url);
  const latResult = parseCoordinate(url.searchParams.get("lat"), "lat");
  if (latResult.error) return latResult.error;
  const lngResult = parseCoordinate(url.searchParams.get("lng"), "lng");
  if (lngResult.error) return lngResult.error;

  const lat = latResult.value;
  const lng = lngResult.value;
  const countryHint = url.searchParams.get("country") ?? undefined;

  const featuresKey = cacheKey(lat, lng, (countryHint ?? "auto").toLowerCase());
  const tfrKey = `tfr:v2:${lat.toFixed(1)}:${lng.toFixed(1)}`;

  const featuresCached = getCacheState<{ bundle: AirspaceBundle }>(featuresKey);
  const tfrCached = getCacheState<AirspaceBundle["tfrs"]>(tfrKey);

  if (featuresCached.state === "fresh" && tfrCached.state === "fresh") {
    const bundle = featuresCached.value.bundle;
    const response: AirspaceResponse = {
      latitude: lat,
      longitude: lng,
      fetchedAt: new Date().toISOString(),
      country: bundle.country,
      dataSources: bundle.dataSources,
      features: bundle.features,
      tfrs: tfrCached.value,
    };
    return Response.json(response);
  }

  try {
    const bundle = await fetchAirspaceBundle(lat, lng, countryHint);
    setCached(featuresKey, { bundle }, CACHE_TTL_MS);
    setCached(tfrKey, bundle.tfrs, TFR_CACHE_TTL_MS);
    const response: AirspaceResponse = {
      latitude: lat,
      longitude: lng,
      fetchedAt: new Date().toISOString(),
      country: bundle.country,
      dataSources: bundle.dataSources,
      features: bundle.features,
      tfrs: bundle.tfrs,
    };
    console.info(
      `[airspace] ${bundle.country} ${bundle.features.length} features, ${bundle.tfrs.length} TFRs`,
    );
    return Response.json(response);
  } catch (error) {
    if (featuresCached.state === "stale") {
      const bundle = featuresCached.value.bundle;
      const response: AirspaceResponse = {
        latitude: lat,
        longitude: lng,
        fetchedAt: new Date().toISOString(),
        country: bundle.country,
        dataSources: bundle.dataSources,
        features: bundle.features,
        tfrs: tfrCached.state === "stale" ? tfrCached.value : [],
      };
      return Response.json(response, { headers: { "x-skycanvas-cache": "stale" } });
    }
    const message = error instanceof Error ? error.message : "Airspace data is unavailable right now.";
    return Response.json({ error: message }, { status: 500 });
  }
});

export const config: Config = {
  path: ["/api/v1/airspace"],
  method: "GET",
};
