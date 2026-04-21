import type { AirspaceClass, AirspaceFeature, AirspacePolygon, IcaoAirspaceClass, TFRFeature } from "../../../packages/weather-domain/src/types";

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const TFR_URL = "https://aviationweather.gov/api/data/tfr";
const SEARCH_RADIUS_M = 30_000;
const TFR_SEARCH_RADIUS_KM = 150;
const TIMEOUT_MS = 8_000;
const TFR_TIMEOUT_MS = 6_000;

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

// FAA NOTAM format from aviationweather.gov/api/data/tfr
type AvwxTFRNotam = {
  id?: string;
  number?: string;
  coordinates?: { lat?: number; lng?: number; lon?: number };
  radius?: number;
  minimumFL?: number;
  maximumFL?: number;
  startDate?: string;
  endDate?: string;
};

type AvwxTFREntry = {
  coreNOTAMData?: {
    notam?: AvwxTFRNotam;
  };
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

    let featureType: AirspaceFeature["featureType"];
    let classification: AirspaceClass;
    let zoneRadiusKm: number;

    if (militaryType === "danger_area" || militaryType === "training_area") {
      featureType = "danger";
      classification = "restricted";
      zoneRadiusKm = 5;
    } else if (aerowayType === "restricted_area" || aerowayType === "prohibited_area") {
      featureType = "restricted";
      classification = "restricted";
      zoneRadiusKm = 3;
    } else if (militaryType === "airfield" || militaryType === "aerodrome") {
      featureType = "military";
      classification = "restricted";
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
      icao,
      classification,
      zoneRadiusKm,
      distanceKm: haversineKm(lat, lng, elLat, elLon),
      bearingDeg: bearingDeg(lat, lng, elLat, elLon),
      ...(altLower !== undefined && !isNaN(altLower) ? { altitudeLowerFt: altLower } : {}),
      ...(altUpper !== undefined && !isNaN(altUpper) ? { altitudeUpperFt: altUpper } : {}),
    });
  }

  return features.sort((a, b) => a.distanceKm - b.distanceKm).slice(0, 25);
}

export async function fetchNearbyTFRs(lat: number, lng: number): Promise<TFRFeature[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TFR_TIMEOUT_MS);

  try {
    const res = await fetch(TFR_URL, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return [];

    const raw: unknown = await res.json();
    if (!Array.isArray(raw)) return [];

    const tfrs: TFRFeature[] = [];

    for (const item of raw as AvwxTFREntry[]) {
      const notam = item?.coreNOTAMData?.notam;
      if (!notam) continue;

      const coords = notam.coordinates;
      if (!coords) continue;

      const tfrLat = coords.lat;
      const tfrLng = coords.lng ?? coords.lon;
      if (tfrLat === undefined || tfrLng === undefined) continue;

      const radiusNm = typeof notam.radius === "number" ? notam.radius : 0;
      const radiusKmTFR = radiusNm * 1.852;
      const distKm = haversineKm(lat, lng, tfrLat, tfrLng);

      if (distKm > TFR_SEARCH_RADIUS_KM + radiusKmTFR) continue;

      tfrs.push({
        id: notam.id ?? notam.number ?? `tfr-${tfrs.length}`,
        notamNumber: notam.number ?? "Unknown",
        latitude: tfrLat,
        longitude: tfrLng,
        radiusNm,
        altitudeLowerFt: typeof notam.minimumFL === "number" ? notam.minimumFL * 100 : 0,
        altitudeUpperFt: typeof notam.maximumFL === "number" ? notam.maximumFL * 100 : 18000,
        effectiveStart: notam.startDate,
        effectiveEnd: notam.endDate,
        distanceKm: distKm,
      });
    }

    return tfrs.sort((a, b) => a.distanceKm - b.distanceKm).slice(0, 20);
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

// ─── OpenAIP ──────────────────────────────────────────────────────────────────
// https://www.openaip.net — worldwide real polygon airspace data (ICAO classes,
// CTR, TMA, restricted, danger, prohibited, etc.). Requires free API key.

const OPENAIP_URL = "https://api.core.openaip.net/api/airspaces";
const OPENAIP_SEARCH_RADIUS_M = 50_000;
const OPENAIP_TIMEOUT_MS = 10_000;

// Numeric enums from OpenAIP v2 API spec
const ICAO_CLASS_MAP: Record<number, IcaoAirspaceClass> = {
  0: "A", 1: "B", 2: "C", 3: "D", 4: "E", 5: "F", 6: "G",
};

const TYPE_LABEL_MAP: Record<number, string> = {
  0: "Other", 1: "Restricted", 2: "Danger", 3: "Prohibited",
  4: "CTR", 5: "TMZ", 6: "RMZ", 7: "TMA", 8: "TRA", 9: "TSA",
  10: "FIR", 11: "UIR", 12: "ADIZ", 13: "ATZ", 14: "MATZ",
  16: "MTR", 17: "Alert", 18: "Warning", 26: "CTA", 28: "Sport",
  29: "Low Flying Zone",
};

// Altitude unit codes: 0=ft, 1=FL (×100 ft), 2=m
function toFeet(value: number, unit: number): number {
  if (unit === 1) return value * 100;          // flight level → feet
  if (unit === 2) return Math.round(value * 3.28084); // metres → feet
  return value;                                 // already feet
}

function classifyOpenAIP(icaoClass: number | undefined, type: number): AirspaceClass {
  if (type === 1 || type === 2 || type === 3) return "restricted"; // R/D/P
  if (icaoClass === 0 || icaoClass === 1 || icaoClass === 2) return "controlled"; // A/B/C
  if (icaoClass === 3 || icaoClass === 4) return "advisory"; // D/E
  return "advisory"; // everything else
}

type OpenAIPLimit = { value: number; unit: number; referenceDatum: number };
type OpenAIPItem = {
  _id: string;
  name?: string;
  icaoClass?: number;
  type?: number;
  country?: string;
  geometry?: { type: string; coordinates: unknown };
  lowerLimit?: OpenAIPLimit;
  upperLimit?: OpenAIPLimit;
};
type OpenAIPResponse = { items?: OpenAIPItem[]; totalCount?: number };

export async function fetchOpenAIPAirspace(lat: number, lng: number, apiKey: string): Promise<AirspacePolygon[]> {
  const params = new URLSearchParams({
    pos: `${lng},${lat}`,           // OpenAIP uses lng,lat order
    dist: String(OPENAIP_SEARCH_RADIUS_M),
    limit: "100",
    page: "1",
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OPENAIP_TIMEOUT_MS);

  try {
    const res = await fetch(`${OPENAIP_URL}?${params}`, {
      signal: controller.signal,
      headers: { "x-openaip-client-id": apiKey, Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`OpenAIP ${res.status}`);

    const data = (await res.json()) as OpenAIPResponse;
    const items = data.items ?? [];
    const polygons: AirspacePolygon[] = [];

    for (const item of items) {
      const geom = item.geometry;
      if (!geom || geom.type !== "Polygon") continue;

      // GeoJSON coords are [lng, lat] arrays; convert to [lat, lng] for Leaflet
      const rawRings = geom.coordinates as number[][][];
      const outerRing = rawRings[0];
      if (!outerRing || outerRing.length < 3) continue;
      const polygon: Array<[number, number]> = outerRing.map(([lng, lat]) => [lat, lng]);

      const typeNum = item.type ?? 0;
      const icaoNum = item.icaoClass;

      polygons.push({
        id: item._id,
        name: item.name ?? "Unnamed",
        icaoClass: icaoNum !== undefined ? ICAO_CLASS_MAP[icaoNum] : undefined,
        type: TYPE_LABEL_MAP[typeNum] ?? "Airspace",
        classification: classifyOpenAIP(icaoNum, typeNum),
        country: item.country,
        polygon,
        altitudeLowerFt: item.lowerLimit
          ? toFeet(item.lowerLimit.value, item.lowerLimit.unit)
          : undefined,
        altitudeUpperFt: item.upperLimit
          ? toFeet(item.upperLimit.value, item.upperLimit.unit)
          : undefined,
      });
    }

    return polygons;
  } finally {
    clearTimeout(timeout);
  }
}
