import type { AirspaceCountry, AirspaceGeometry } from "../../../../packages/weather-domain/src/types";

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function bearingDeg(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const lat1R = (lat1 * Math.PI) / 180;
  const lat2R = (lat2 * Math.PI) / 180;
  const y = Math.sin(dLon) * Math.cos(lat2R);
  const x = Math.cos(lat1R) * Math.sin(lat2R) - Math.sin(lat1R) * Math.cos(lat2R) * Math.cos(dLon);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

// Rough bounding box expressed as [minLng, minLat, maxLng, maxLat] in EPSG:4326.
export function bboxAround(lat: number, lng: number, radiusKm: number): [number, number, number, number] {
  const latDelta = radiusKm / 110.574;
  const lngDelta = radiusKm / (111.32 * Math.max(Math.cos((lat * Math.PI) / 180), 0.01));
  return [lng - lngDelta, lat - latDelta, lng + lngDelta, lat + latDelta];
}

export function detectCountry(lat: number, lng: number, hint?: string): AirspaceCountry {
  const c = (hint ?? "").trim().toLowerCase();
  if (c === "us" || c === "united states" || c === "usa") return "US";
  if (c === "ca" || c === "canada") return "CA";
  if (c === "jp" || c === "japan") return "JP";
  if (c === "other") return "OTHER";

  // Order matters: check JP/CA before US because the US bbox overlaps neighbours.
  if (lat >= 24 && lat <= 46 && lng >= 122 && lng <= 146) return "JP";
  if (lat >= 41.5 && lat <= 84 && lng >= -142 && lng <= -52) return "CA";
  if (
    (lat >= 24 && lat <= 49 && lng >= -125 && lng <= -66) ||
    (lat >= 51 && lat <= 72 && lng >= -170 && lng <= -130) ||
    (lat >= 18 && lat <= 23 && lng >= -161 && lng <= -154)
  ) {
    return "US";
  }
  return "OTHER";
}

function centroidRing(ring: [number, number][]): { lat: number; lng: number } {
  let lat = 0;
  let lng = 0;
  for (const [x, y] of ring) {
    lng += x;
    lat += y;
  }
  const n = ring.length || 1;
  return { lat: lat / n, lng: lng / n };
}

export function geometryCentroid(geometry: AirspaceGeometry): { lat: number; lng: number } {
  if (geometry.type === "Point") {
    return { lat: geometry.coordinates[1], lng: geometry.coordinates[0] };
  }
  if (geometry.type === "Polygon") {
    return centroidRing(geometry.coordinates[0] ?? []);
  }
  const firstPolygon = geometry.coordinates[0];
  return centroidRing(firstPolygon?.[0] ?? []);
}

function pointInRing(lat: number, lng: number, ring: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersect =
      yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi + Number.EPSILON) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function pointInGeometry(lat: number, lng: number, geometry: AirspaceGeometry): boolean {
  if (geometry.type === "Point") return false;
  const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  for (const polygon of polygons) {
    const [outer, ...holes] = polygon;
    if (!outer) continue;
    if (!pointInRing(lat, lng, outer)) continue;
    let inHole = false;
    for (const hole of holes) {
      if (pointInRing(lat, lng, hole)) {
        inHole = true;
        break;
      }
    }
    if (!inHole) return true;
  }
  return false;
}

export function distanceKmToGeometry(lat: number, lng: number, geometry: AirspaceGeometry): number {
  if (pointInGeometry(lat, lng, geometry)) return 0;
  const centroid = geometryCentroid(geometry);
  return haversineKm(lat, lng, centroid.lat, centroid.lng);
}

export function polygonApproxRadiusKm(geometry: AirspaceGeometry): number {
  const centroid = geometryCentroid(geometry);
  const outerRing =
    geometry.type === "Polygon"
      ? geometry.coordinates[0]
      : geometry.type === "MultiPolygon"
      ? geometry.coordinates[0]?.[0]
      : undefined;
  if (!outerRing || outerRing.length === 0) return 0;
  let maxKm = 0;
  for (const [lng, lat] of outerRing) {
    const d = haversineKm(centroid.lat, centroid.lng, lat, lng);
    if (d > maxKm) maxKm = d;
  }
  return maxKm;
}
