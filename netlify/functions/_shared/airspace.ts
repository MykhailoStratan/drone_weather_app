import type { AirspaceClass, AirspaceFeature } from "../../../packages/weather-domain/src/types";

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const SEARCH_RADIUS_M = 30_000;
const TIMEOUT_MS = 8_000;

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

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function bearingDeg(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const lat1R = (lat1 * Math.PI) / 180;
  const lat2R = (lat2 * Math.PI) / 180;
  const y = Math.sin(dLon) * Math.cos(lat2R);
  const x = Math.cos(lat1R) * Math.sin(lat2R) - Math.sin(lat1R) * Math.cos(lat2R) * Math.cos(dLon);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function classifyAirport(tags: Record<string, string>): { classification: AirspaceClass; zoneRadiusKm: number } {
  const icao = tags["icao"] ?? tags["ref:icao"];
  const type = tags["aerodrome:type"] ?? tags["aeroway"];

  if (type === "helipad" || type === "heliport") {
    return { classification: "advisory", zoneRadiusKm: 0.5 };
  }

  if (!icao) {
    return { classification: "advisory", zoneRadiusKm: 2.5 };
  }

  const isLarge =
    (tags["aerodrome:class"] ?? tags["designation"] ?? "").toLowerCase().includes("international") ||
    (tags["name"] ?? "").toLowerCase().includes("international");

  return {
    classification: "controlled",
    zoneRadiusKm: isLarge ? 10 : 5,
  };
}

export async function fetchNearbyAirspace(lat: number, lng: number): Promise<AirspaceFeature[]> {
  const query = `
[out:json][timeout:15];
(
  node["aeroway"~"^(aerodrome|airport|airstrip)$"](around:${SEARCH_RADIUS_M},${lat},${lng});
  way["aeroway"~"^(aerodrome|airport|airstrip)$"](around:${SEARCH_RADIUS_M},${lat},${lng});
  node["aeroway"="helipad"](around:${SEARCH_RADIUS_M},${lat},${lng});
  node["aeroway"="heliport"](around:${SEARCH_RADIUS_M},${lat},${lng});
);
out center tags;
`.trim();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let data: OverpassResponse;
  try {
    const res = await fetch(OVERPASS_URL, {
      method: "POST",
      body: query,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error("Overpass API error");
    data = (await res.json()) as OverpassResponse;
  } finally {
    clearTimeout(timeout);
  }

  const seen = new Set<string>();
  const features: AirspaceFeature[] = [];

  for (const el of data.elements) {
    const elLat = el.lat ?? el.center?.lat;
    const elLon = el.lon ?? el.center?.lon;
    if (elLat === undefined || elLon === undefined) continue;

    const tags = el.tags ?? {};
    const name = tags["name"] ?? tags["ref"] ?? "Unknown aerodrome";
    const icao = tags["icao"] ?? tags["ref:icao"];
    const aerowayType = tags["aeroway"] ?? "aerodrome";
    const featureType =
      aerowayType === "helipad" || aerowayType === "heliport"
        ? "helipad"
        : aerowayType === "airport"
        ? "airport"
        : "aerodrome";

    const dedupeKey = `${name}:${Math.round(elLat * 100)}:${Math.round(elLon * 100)}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    const { classification, zoneRadiusKm } = classifyAirport(tags);

    features.push({
      id: `${el.type}/${el.id}`,
      name,
      featureType,
      latitude: elLat,
      longitude: elLon,
      icao,
      classification,
      zoneRadiusKm,
      distanceKm: haversineKm(lat, lng, elLat, elLon),
      bearingDeg: bearingDeg(lat, lng, elLat, elLon),
    });
  }

  return features.sort((a, b) => a.distanceKm - b.distanceKm).slice(0, 20);
}
