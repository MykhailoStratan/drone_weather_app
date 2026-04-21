import type {
  AirspaceClass,
  AirspaceFeature,
  AirspaceFeatureType,
  TFRFeature,
} from "../../../../packages/weather-domain/src/types";
import {
  bboxAround,
  bearingDeg,
  distanceKmToGeometry,
  geometryCentroid,
  haversineKm,
  polygonApproxRadiusKm,
} from "./geo";
import { esriPolygonToGeoJson, queryArcgisFeatureLayer } from "./arcgis";

const FAA_CLASS_LAYER =
  "https://services6.arcgis.com/ssFJjBXIUyZDrSYZ/ArcGIS/rest/services/Class_Airspace/FeatureServer/0";
const FAA_SUA_LAYER =
  "https://services6.arcgis.com/ssFJjBXIUyZDrSYZ/ArcGIS/rest/services/Special_Use_Airspace/FeatureServer/0";
const FAA_SEARCH_RADIUS_KM = 60;
const TFR_URL = "https://aviationweather.gov/api/data/tfr";
const TFR_SEARCH_RADIUS_KM = 150;
const TFR_TIMEOUT_MS = 6_000;

type FaaClassAttributes = {
  OBJECTID?: number;
  GLOBAL_ID?: string;
  NAME?: string;
  ICAO_ID?: string;
  LOCAL_TYPE?: string;
  TYPE_CODE?: string;
  UPPER_VAL?: number;
  UPPER_UOM?: string;
  UPPER_DESC?: string;
  LOWER_VAL?: number;
  LOWER_UOM?: string;
  LOWER_DESC?: string;
  CLASS?: string;
};

type FaaSuaAttributes = {
  OBJECTID?: number;
  GLOBAL_ID?: string;
  NAME?: string;
  TYPE_CODE?: string;
  CLASS?: string;
  UPPER_VAL?: string | number;
  LOWER_VAL?: string | number;
  UPPER_UOM?: string;
  LOWER_UOM?: string;
};

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

function feetFromUom(value: number | string | undefined, uom: string | undefined): number | undefined {
  const num = typeof value === "string" ? Number(value) : value;
  if (num === undefined || !Number.isFinite(num)) return undefined;
  const unit = (uom ?? "").toUpperCase();
  if (unit === "FT") return num;
  if (unit === "FL") return num * 100;
  if (unit === "M") return Math.round(num * 3.28084);
  return num;
}

function classifyFaaClass(attrs: FaaClassAttributes): {
  featureType: AirspaceFeatureType;
  classification: AirspaceClass;
} {
  const local = (attrs.LOCAL_TYPE ?? attrs.CLASS ?? "").toUpperCase();
  const type = (attrs.TYPE_CODE ?? "").toUpperCase();
  if (local.includes("B") || type === "CLASS_B") return { featureType: "class_b", classification: "controlled" };
  if (local.includes("C") || type === "CLASS_C") return { featureType: "class_c", classification: "controlled" };
  if (local.includes("D") || type === "CLASS_D") return { featureType: "class_d", classification: "controlled" };
  if (local.includes("E") || type === "CLASS_E") return { featureType: "class_e", classification: "advisory" };
  return { featureType: "class_d", classification: "controlled" };
}

function classifyFaaSua(attrs: FaaSuaAttributes): {
  featureType: AirspaceFeatureType;
  classification: AirspaceClass;
} {
  const code = (attrs.TYPE_CODE ?? attrs.CLASS ?? "").toUpperCase();
  if (code.startsWith("R")) return { featureType: "restricted", classification: "restricted" };
  if (code.startsWith("P")) return { featureType: "prohibited", classification: "restricted" };
  if (code.startsWith("W")) return { featureType: "warning", classification: "military" };
  if (code.startsWith("A")) return { featureType: "alert", classification: "military" };
  if (code.startsWith("MOA") || code.includes("MOA")) return { featureType: "moa", classification: "military" };
  if (code.startsWith("D")) return { featureType: "danger", classification: "danger" };
  return { featureType: "restricted", classification: "restricted" };
}

export async function fetchFaaAirspace(lat: number, lng: number): Promise<AirspaceFeature[]> {
  const bbox = bboxAround(lat, lng, FAA_SEARCH_RADIUS_KM);
  const [classRaw, suaRaw] = await Promise.all([
    queryArcgisFeatureLayer<FaaClassAttributes>(FAA_CLASS_LAYER, bbox),
    queryArcgisFeatureLayer<FaaSuaAttributes>(FAA_SUA_LAYER, bbox),
  ]);

  const features: AirspaceFeature[] = [];

  for (const raw of classRaw) {
    const geom = raw.geometry && "rings" in raw.geometry ? esriPolygonToGeoJson(raw.geometry) : null;
    if (!geom) continue;
    const attrs = raw.attributes ?? {};
    const { featureType, classification } = classifyFaaClass(attrs);
    const centroid = geometryCentroid(geom);
    const distanceKm = distanceKmToGeometry(lat, lng, geom);
    features.push({
      id: `faa-class/${attrs.GLOBAL_ID ?? attrs.OBJECTID ?? features.length}`,
      name: attrs.NAME ?? `Class ${featureType.slice(-1).toUpperCase()} airspace`,
      featureType,
      icao: attrs.ICAO_ID?.trim() || undefined,
      classification,
      latitude: centroid.lat,
      longitude: centroid.lng,
      geometry: geom,
      zoneRadiusKm: polygonApproxRadiusKm(geom),
      distanceKm,
      bearingDeg: bearingDeg(lat, lng, centroid.lat, centroid.lng),
      altitudeLowerFt: feetFromUom(attrs.LOWER_VAL, attrs.LOWER_UOM),
      altitudeUpperFt: feetFromUom(attrs.UPPER_VAL, attrs.UPPER_UOM),
      source: "faa",
    });
  }

  for (const raw of suaRaw) {
    const geom = raw.geometry && "rings" in raw.geometry ? esriPolygonToGeoJson(raw.geometry) : null;
    if (!geom) continue;
    const attrs = raw.attributes ?? {};
    const { featureType, classification } = classifyFaaSua(attrs);
    const centroid = geometryCentroid(geom);
    const distanceKm = distanceKmToGeometry(lat, lng, geom);
    features.push({
      id: `faa-sua/${attrs.GLOBAL_ID ?? attrs.OBJECTID ?? features.length}`,
      name: attrs.NAME ?? `${attrs.TYPE_CODE ?? "Special use"} airspace`,
      featureType,
      classification,
      latitude: centroid.lat,
      longitude: centroid.lng,
      geometry: geom,
      zoneRadiusKm: polygonApproxRadiusKm(geom),
      distanceKm,
      bearingDeg: bearingDeg(lat, lng, centroid.lat, centroid.lng),
      altitudeLowerFt: feetFromUom(attrs.LOWER_VAL, attrs.LOWER_UOM),
      altitudeUpperFt: feetFromUom(attrs.UPPER_VAL, attrs.UPPER_UOM),
      source: "faa",
    });
  }

  return features
    .filter((f) => f.distanceKm <= FAA_SEARCH_RADIUS_KM + (f.zoneRadiusKm ?? 0))
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, 40);
}

export async function fetchFaaTfrs(lat: number, lng: number): Promise<TFRFeature[]> {
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
