import type {
  AirspaceClass,
  AirspaceFeature,
  AirspaceFeatureType,
  AirspaceGeometry,
} from "../../../../packages/weather-domain/src/types";
import {
  bearingDeg,
  distanceKmToGeometry,
  geometryCentroid,
  polygonApproxRadiusKm,
} from "./geo";

const OPENAIP_URL = "https://api.core.openaip.net/api/airspaces";
const SEARCH_RADIUS_M = 50_000;
const TIMEOUT_MS = 10_000;

type OpenAIPLimit = {
  value?: number;
  unit?: number;
};

type OpenAIPItem = {
  _id?: string;
  id?: string;
  name?: string;
  icaoClass?: number;
  type?: number;
  country?: string;
  geometry?: {
    type?: string;
    coordinates?: unknown;
  };
  lowerLimit?: OpenAIPLimit;
  upperLimit?: OpenAIPLimit;
};

type OpenAIPResponse = {
  items?: OpenAIPItem[];
};

const ICAO_CLASS_LABELS: Record<number, AirspaceFeatureType> = {
  1: "class_b",
  2: "class_c",
  3: "class_d",
  4: "class_e",
};

function toFeet(value: number, unit: number | undefined): number {
  if (unit === 1) return value * 100;
  if (unit === 2) return Math.round(value * 3.28084);
  return value;
}

function limitToFeet(limit: OpenAIPLimit | undefined): number | undefined {
  if (limit?.value === undefined || !Number.isFinite(limit.value)) return undefined;
  return toFeet(limit.value, limit.unit);
}

function classifyOpenAip(icaoClass: number | undefined, type: number): AirspaceClass {
  if (type === 1 || type === 3) return "restricted";
  if (type === 2) return "danger";
  if (type === 4 || type === 7 || type === 26) return "controlled";
  if (icaoClass === 0 || icaoClass === 1 || icaoClass === 2) return "controlled";
  return "advisory";
}

function featureTypeFor(icaoClass: number | undefined, type: number): AirspaceFeatureType {
  if (type === 1) return "restricted";
  if (type === 2) return "danger";
  if (type === 3) return "prohibited";
  if (type === 4) return "ctr";
  if (type === 17) return "alert";
  if (type === 18) return "warning";
  return icaoClass !== undefined ? ICAO_CLASS_LABELS[icaoClass] ?? "restricted" : "restricted";
}

function isLngLat(value: unknown): value is [number, number] {
  return Array.isArray(value) &&
    value.length >= 2 &&
    typeof value[0] === "number" &&
    typeof value[1] === "number" &&
    Number.isFinite(value[0]) &&
    Number.isFinite(value[1]);
}

function normalizeRing(value: unknown): [number, number][] | null {
  if (!Array.isArray(value)) return null;
  const ring = value.filter(isLngLat).map(([lng, lat]) => [lng, lat] as [number, number]);
  return ring.length >= 3 ? ring : null;
}

function normalizePolygon(value: unknown): [number, number][][] | null {
  if (!Array.isArray(value)) return null;
  const rings = value.map(normalizeRing).filter((ring): ring is [number, number][] => Boolean(ring));
  return rings.length > 0 ? rings : null;
}

function normalizeGeometry(item: OpenAIPItem): AirspaceGeometry | null {
  const geometry = item.geometry;
  if (!geometry?.type || !geometry.coordinates) return null;

  if (geometry.type === "Polygon") {
    const polygon = normalizePolygon(geometry.coordinates);
    return polygon ? { type: "Polygon", coordinates: polygon } : null;
  }

  if (geometry.type === "MultiPolygon" && Array.isArray(geometry.coordinates)) {
    const polygons = geometry.coordinates
      .map(normalizePolygon)
      .filter((polygon): polygon is [number, number][][] => Boolean(polygon));
    return polygons.length > 0 ? { type: "MultiPolygon", coordinates: polygons } : null;
  }

  return null;
}

export async function fetchOpenAipAirspace(
  lat: number,
  lng: number,
  apiKey: string,
): Promise<AirspaceFeature[]> {
  const params = new URLSearchParams({
    pos: `${lat},${lng}`,
    dist: String(SEARCH_RADIUS_M),
    limit: "100",
    page: "1",
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(`${OPENAIP_URL}?${params}`, {
      signal: controller.signal,
      headers: {
        "x-openaip-client-id": apiKey,
        Accept: "application/json",
      },
    });
    if (!res.ok) throw new Error(`OpenAIP ${res.status}`);

    const data = (await res.json()) as OpenAIPResponse;
    const features: AirspaceFeature[] = [];

    for (const item of data.items ?? []) {
      const geometry = normalizeGeometry(item);
      if (!geometry) continue;

      const centroid = geometryCentroid(geometry);
      const type = item.type ?? 0;
      const classification = classifyOpenAip(item.icaoClass, type);

      features.push({
        id: item._id ?? item.id ?? `openaip-${features.length}`,
        name: item.name ?? "Unnamed airspace",
        featureType: featureTypeFor(item.icaoClass, type),
        latitude: centroid.lat,
        longitude: centroid.lng,
        geometry,
        classification,
        zoneRadiusKm: polygonApproxRadiusKm(geometry),
        distanceKm: distanceKmToGeometry(lat, lng, geometry),
        bearingDeg: bearingDeg(lat, lng, centroid.lat, centroid.lng),
        altitudeLowerFt: limitToFeet(item.lowerLimit),
        altitudeUpperFt: limitToFeet(item.upperLimit),
        source: "openaip",
      });
    }

    return features.sort((a, b) => a.distanceKm - b.distanceKm).slice(0, 100);
  } finally {
    clearTimeout(timeout);
  }
}
