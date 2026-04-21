import type {
  AirspaceClass,
  AirspaceFeature,
  AirspaceFeatureType,
} from "../../../../packages/weather-domain/src/types";
import { bboxAround, bearingDeg, haversineKm } from "./geo";
import { queryArcgisFeatureLayer, type EsriFeature } from "./arcgis";

const TC_AIRPORTS_LAYER =
  "https://maps-cartes.services.geo.ca/server_serveur/rest/services/TC/canadian_airports_w_air_navigation_services_en/MapServer/0";
const CA_SEARCH_RADIUS_KM = 30;

// Canadian Aviation Regulations Part IX Section 901.71-73 forbid RPAS flight within
// 3 NM of a certified airport with an operational control tower, or 1 NM of a
// certified heliport/aerodrome without one. Ring buffers reflect those limits.
const CA_CONTROLLED_RADIUS_KM = 5.556; // 3 NM
const CA_ADVISORY_RADIUS_KM = 1.852; // 1 NM
const CA_HELIPAD_RADIUS_KM = 0.5;

type TcAirportAttributes = {
  OBJECTID?: number;
  AIRPORT_NAME?: string;
  NAME?: string;
  ICAO_CODE?: string;
  ICAO?: string;
  FACILITY_TYPE?: string;
  NAV_SERVICE?: string;
  SERVICE_TYPE?: string;
  LATITUDE?: number;
  LONGITUDE?: number;
};

type TcPoint = { x: number; y: number };

function classifyTcAirport(attrs: TcAirportAttributes): {
  featureType: AirspaceFeatureType;
  classification: AirspaceClass;
  zoneRadiusKm: number;
} {
  const service = [attrs.NAV_SERVICE, attrs.SERVICE_TYPE, attrs.FACILITY_TYPE]
    .filter(Boolean)
    .join(" ")
    .toUpperCase();

  if (service.includes("HELIPORT") || service.includes("HELIPAD")) {
    return { featureType: "helipad", classification: "advisory", zoneRadiusKm: CA_HELIPAD_RADIUS_KM };
  }
  if (service.includes("TOWER") || service.includes("CONTROL") || service.includes("ATC")) {
    return { featureType: "ctr", classification: "controlled", zoneRadiusKm: CA_CONTROLLED_RADIUS_KM };
  }
  if (service.includes("FSS") || service.includes("MF") || service.includes("ATF")) {
    return { featureType: "aerodrome", classification: "advisory", zoneRadiusKm: CA_ADVISORY_RADIUS_KM };
  }
  return { featureType: "aerodrome", classification: "advisory", zoneRadiusKm: CA_ADVISORY_RADIUS_KM };
}

function extractPoint(feature: EsriFeature<TcAirportAttributes>): { lat: number; lng: number } | null {
  const geom = feature.geometry;
  if (geom && "x" in geom && "y" in geom) {
    const pt = geom as TcPoint;
    if (Number.isFinite(pt.x) && Number.isFinite(pt.y)) {
      return { lat: pt.y, lng: pt.x };
    }
  }
  const attrs = feature.attributes ?? {};
  if (attrs.LATITUDE !== undefined && attrs.LONGITUDE !== undefined) {
    return { lat: attrs.LATITUDE, lng: attrs.LONGITUDE };
  }
  return null;
}

export async function fetchCanadaAirspace(lat: number, lng: number): Promise<AirspaceFeature[]> {
  const bbox = bboxAround(lat, lng, CA_SEARCH_RADIUS_KM);
  const raw = await queryArcgisFeatureLayer<TcAirportAttributes>(TC_AIRPORTS_LAYER, bbox);

  const features: AirspaceFeature[] = [];
  for (const entry of raw) {
    const point = extractPoint(entry);
    if (!point) continue;
    const attrs = entry.attributes ?? {};
    const { featureType, classification, zoneRadiusKm } = classifyTcAirport(attrs);
    const distanceKm = haversineKm(lat, lng, point.lat, point.lng);
    if (distanceKm > CA_SEARCH_RADIUS_KM + zoneRadiusKm) continue;
    const icao = (attrs.ICAO_CODE ?? attrs.ICAO)?.trim() || undefined;
    const name = attrs.AIRPORT_NAME ?? attrs.NAME ?? icao ?? "Canadian aerodrome";

    features.push({
      id: `tc/${attrs.OBJECTID ?? `${point.lat.toFixed(4)},${point.lng.toFixed(4)}`}`,
      name,
      featureType,
      icao,
      classification,
      latitude: point.lat,
      longitude: point.lng,
      geometry: { type: "Point", coordinates: [point.lng, point.lat] },
      zoneRadiusKm,
      distanceKm,
      bearingDeg: bearingDeg(lat, lng, point.lat, point.lng),
      source: "transport-canada",
    });
  }

  return features.sort((a, b) => a.distanceKm - b.distanceKm).slice(0, 25);
}
