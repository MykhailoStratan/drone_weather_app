import type {
  AirspaceClass,
  AirspaceFeature,
  AirspaceFeatureType,
} from "../../../../packages/weather-domain/src/types";
import { bearingDeg, haversineKm } from "./geo";

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

function classifyAirport(tags: Record<string, string>): {
  classification: AirspaceClass;
  zoneRadiusKm: number;
} {
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
  return { classification: "controlled", zoneRadiusKm: isLarge ? 10 : 5 };
}

export async function fetchOverpassAirspace(lat: number, lng: number): Promise<AirspaceFeature[]> {
  const query = `
[out:json][timeout:15];
(
  node["aeroway"~"^(aerodrome|airport|airstrip)$"](around:${SEARCH_RADIUS_M},${lat},${lng});
  way["aeroway"~"^(aerodrome|airport|airstrip)$"](around:${SEARCH_RADIUS_M},${lat},${lng});
  node["aeroway"="helipad"](around:${SEARCH_RADIUS_M},${lat},${lng});
  node["aeroway"="heliport"](around:${SEARCH_RADIUS_M},${lat},${lng});
  node["military"~"^(airfield|aerodrome)$"](around:${SEARCH_RADIUS_M},${lat},${lng});
  way["military"~"^(airfield|aerodrome)$"](around:${SEARCH_RADIUS_M},${lat},${lng});
  relation["military"~"^(airfield|aerodrome|danger_area|training_area)$"](around:${SEARCH_RADIUS_M},${lat},${lng});
  relation["aeroway"~"^(restricted_area|prohibited_area)$"](around:${SEARCH_RADIUS_M},${lat},${lng});
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
    const aerowayType = tags["aeroway"] ?? "";
    const militaryType = tags["military"] ?? "";

    let featureType: AirspaceFeatureType;
    let classification: AirspaceClass;
    let zoneRadiusKm: number;

    if (militaryType === "danger_area" || militaryType === "training_area") {
      featureType = "danger";
      classification = "danger";
      zoneRadiusKm = 5;
    } else if (aerowayType === "restricted_area" || aerowayType === "prohibited_area") {
      featureType = "restricted";
      classification = "restricted";
      zoneRadiusKm = 3;
    } else if (militaryType === "airfield" || militaryType === "aerodrome") {
      featureType = "military";
      classification = "military";
      zoneRadiusKm = 5;
    } else {
      featureType =
        aerowayType === "helipad" || aerowayType === "heliport"
          ? "helipad"
          : aerowayType === "airport"
          ? "airport"
          : "aerodrome";
      const classified = classifyAirport(tags);
      classification = classified.classification;
      zoneRadiusKm = classified.zoneRadiusKm;
    }

    const dedupeKey = `${name}:${Math.round(elLat * 100)}:${Math.round(elLon * 100)}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    const altLower = tags["alt:lower"] ? Number(tags["alt:lower"]) : undefined;
    const altUpper = tags["alt:upper"] ? Number(tags["alt:upper"]) : undefined;

    features.push({
      id: `${el.type}/${el.id}`,
      name,
      featureType,
      latitude: elLat,
      longitude: elLon,
      geometry: { type: "Point", coordinates: [elLon, elLat] },
      icao,
      classification,
      zoneRadiusKm,
      distanceKm: haversineKm(lat, lng, elLat, elLon),
      bearingDeg: bearingDeg(lat, lng, elLat, elLon),
      ...(altLower !== undefined && !isNaN(altLower) ? { altitudeLowerFt: altLower } : {}),
      ...(altUpper !== undefined && !isNaN(altUpper) ? { altitudeUpperFt: altUpper } : {}),
      source: "osm",
    });
  }

  return features.sort((a, b) => a.distanceKm - b.distanceKm).slice(0, 25);
}
