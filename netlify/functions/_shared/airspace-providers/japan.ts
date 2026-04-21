import type { AirspaceFeature } from "../../../../packages/weather-domain/src/types";
import { bearingDeg, haversineKm } from "./geo";

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const JP_SEARCH_RADIUS_M = 40_000;
const JP_TIMEOUT_MS = 9_000;

// Japan's Civil Aeronautics Act (航空法) designates no-fly buffers around airports
// and helicopter landing areas. Depending on airport class the restriction radius
// varies, so we use a conservative 9 km ring for controlled fields and 3 km
// otherwise. JCAB publishes no open polygon API, hence rule-based rings.
const JP_CONTROLLED_RADIUS_KM = 9;
const JP_AERODROME_RADIUS_KM = 3;
const JP_HELIPAD_RADIUS_KM = 1;

type OverpassElement = {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

type OverpassResponse = {
  elements: OverpassElement[];
};

export async function fetchJapanAirspace(lat: number, lng: number): Promise<AirspaceFeature[]> {
  const query = `
[out:json][timeout:15];
(
  node["aeroway"~"^(aerodrome|airport)$"](around:${JP_SEARCH_RADIUS_M},${lat},${lng});
  way["aeroway"~"^(aerodrome|airport)$"](around:${JP_SEARCH_RADIUS_M},${lat},${lng});
  node["aeroway"="helipad"](around:${JP_SEARCH_RADIUS_M},${lat},${lng});
  node["aeroway"="heliport"](around:${JP_SEARCH_RADIUS_M},${lat},${lng});
);
out center tags;
`.trim();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), JP_TIMEOUT_MS);
  let data: OverpassResponse;
  try {
    const res = await fetch(OVERPASS_URL, {
      method: "POST",
      body: query,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      signal: controller.signal,
    });
    if (!res.ok) return [];
    data = (await res.json()) as OverpassResponse;
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }

  const features: AirspaceFeature[] = [];
  const seen = new Set<string>();

  for (const el of data.elements) {
    const elLat = el.lat ?? el.center?.lat;
    const elLon = el.lon ?? el.center?.lon;
    if (elLat === undefined || elLon === undefined) continue;
    const tags = el.tags ?? {};
    const aeroway = tags["aeroway"] ?? "";
    const name =
      tags["name:en"] ?? tags["name"] ?? tags["ref"] ?? tags["icao"] ?? "Japanese aerodrome";

    let featureType: AirspaceFeature["featureType"];
    let classification: AirspaceFeature["classification"];
    let zoneRadiusKm: number;

    if (aeroway === "helipad" || aeroway === "heliport") {
      featureType = "helipad";
      classification = "advisory";
      zoneRadiusKm = JP_HELIPAD_RADIUS_KM;
    } else if (tags["icao"] || tags["ref:icao"] || aeroway === "airport") {
      featureType = "airport";
      classification = "controlled";
      zoneRadiusKm = JP_CONTROLLED_RADIUS_KM;
    } else {
      featureType = "aerodrome";
      classification = "advisory";
      zoneRadiusKm = JP_AERODROME_RADIUS_KM;
    }

    const dedupe = `${Math.round(elLat * 1000)}:${Math.round(elLon * 1000)}:${name}`;
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);

    features.push({
      id: `jcaa/${el.type}/${el.id}`,
      name,
      featureType,
      icao: tags["icao"] ?? tags["ref:icao"],
      classification,
      latitude: elLat,
      longitude: elLon,
      geometry: { type: "Point", coordinates: [elLon, elLat] },
      zoneRadiusKm,
      distanceKm: haversineKm(lat, lng, elLat, elLon),
      bearingDeg: bearingDeg(lat, lng, elLat, elLon),
      source: "japan-caa",
    });
  }

  return features.sort((a, b) => a.distanceKm - b.distanceKm).slice(0, 20);
}
