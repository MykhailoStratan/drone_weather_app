import type { Config } from "@netlify/functions";
import { getCacheState, setCached } from "./_shared/cache";
import { fetchNearbyAirspace, fetchNearbyTFRs, fetchOpenAIPAirspace } from "./_shared/airspace";
import type { AirspacePolygon, AirspaceResponse } from "../../packages/weather-domain/src/types";

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;  // 6 hours — airports/polygons don't move
const TFR_CACHE_TTL_MS = 15 * 60 * 1000;  // 15 minutes — TFRs change frequently

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

  const openAipKey = process.env.OPENAIP_CLIENT_ID ?? "";
  const useOpenAIP = openAipKey.length > 0;

  const featuresCacheKey = `airspace:${lat.toFixed(2)}:${lng.toFixed(2)}`;
  const polygonsCacheKey = `airspace-poly:${lat.toFixed(2)}:${lng.toFixed(2)}`;
  const tfrCacheKey = `tfr:${lat.toFixed(1)}:${lng.toFixed(1)}`;

  const featuresCached = getCacheState<AirspaceResponse["features"]>(featuresCacheKey);
  const polygonsCached = getCacheState<AirspacePolygon[]>(polygonsCacheKey);
  const tfrCached = getCacheState<AirspaceResponse["tfrs"]>(tfrCacheKey);

  const polygonsFresh = !useOpenAIP || polygonsCached.state === "fresh";

  if (featuresCached.state === "fresh" && tfrCached.state === "fresh" && polygonsFresh) {
    console.info(`[airspace] cache=fresh ${featuresCacheKey}`);
    const response: AirspaceResponse = {
      latitude: lat,
      longitude: lng,
      fetchedAt: new Date().toISOString(),
      features: featuresCached.value,
      polygons: useOpenAIP ? (polygonsCached.state === "fresh" ? polygonsCached.value : []) : [],
      tfrs: tfrCached.value,
      source: useOpenAIP ? "openaip" : "overpass",
    };
    return Response.json(response);
  }

  try {
    const [features, polygons, tfrs] = await Promise.all([
      featuresCached.state === "fresh"
        ? Promise.resolve(featuresCached.value)
        : fetchNearbyAirspace(lat, lng),

      useOpenAIP && polygonsCached.state !== "fresh"
        ? fetchOpenAIPAirspace(lat, lng, openAipKey)
        : Promise.resolve(polygonsCached.state === "fresh" ? polygonsCached.value : [] as AirspacePolygon[]),

      tfrCached.state === "fresh"
        ? Promise.resolve(tfrCached.value)
        : fetchNearbyTFRs(lat, lng),
    ]);

    if (featuresCached.state !== "fresh") setCached(featuresCacheKey, features, CACHE_TTL_MS);
    if (useOpenAIP && polygonsCached.state !== "fresh") setCached(polygonsCacheKey, polygons, CACHE_TTL_MS);
    if (tfrCached.state !== "fresh") setCached(tfrCacheKey, tfrs, TFR_CACHE_TTL_MS);

    const response: AirspaceResponse = {
      latitude: lat,
      longitude: lng,
      fetchedAt: new Date().toISOString(),
      features,
      polygons,
      tfrs,
      source: useOpenAIP ? "openaip" : "overpass",
    };
    console.info(`[airspace] refreshed ${featuresCacheKey} — ${features.length} features, ${polygons.length} polygons, ${tfrs.length} TFRs (source=${response.source})`);
    return Response.json(response);
  } catch (error) {
    if (featuresCached.state === "stale") {
      console.warn(`[airspace] stale fallback ${featuresCacheKey}`);
      const response: AirspaceResponse = {
        latitude: lat,
        longitude: lng,
        fetchedAt: new Date().toISOString(),
        features: featuresCached.value,
        polygons: polygonsCached.state === "stale" ? polygonsCached.value : [],
        tfrs: tfrCached.state === "stale" ? tfrCached.value : [],
        source: useOpenAIP ? "openaip" : "overpass",
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
