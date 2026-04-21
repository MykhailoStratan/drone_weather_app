import type { AirspaceGeometry } from "../../../../packages/weather-domain/src/types";

type EsriPolygon = {
  rings: [number, number][][];
  spatialReference?: { wkid?: number };
};

type EsriPoint = {
  x: number;
  y: number;
  spatialReference?: { wkid?: number };
};

export type EsriFeature<A = Record<string, unknown>> = {
  attributes?: A;
  geometry?: EsriPolygon | EsriPoint;
};

export type EsriQueryResponse<A = Record<string, unknown>> = {
  features?: EsriFeature<A>[];
  exceededTransferLimit?: boolean;
  error?: { code: number; message: string };
};

// Esri returns polygons as arrays of rings with orientation encoding interior/exterior.
// We flatten to GeoJSON Polygon/MultiPolygon by grouping clockwise rings as outer shells
// and counter-clockwise rings as holes of the preceding shell.
function ringIsClockwise(ring: [number, number][]): boolean {
  let sum = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[(i + 1) % ring.length];
    sum += (x2 - x1) * (y2 + y1);
  }
  return sum > 0;
}

export function esriPolygonToGeoJson(esri: EsriPolygon): AirspaceGeometry | null {
  if (!esri.rings || esri.rings.length === 0) return null;
  const polygons: [number, number][][][] = [];
  let current: [number, number][][] | null = null;
  for (const ring of esri.rings) {
    if (ring.length < 3) continue;
    if (ringIsClockwise(ring)) {
      current = [ring];
      polygons.push(current);
    } else if (current) {
      current.push(ring);
    } else {
      // Hole without a shell — treat as standalone CCW outer ring.
      current = [ring];
      polygons.push(current);
    }
  }
  if (polygons.length === 0) return null;
  if (polygons.length === 1) {
    return { type: "Polygon", coordinates: polygons[0] };
  }
  return { type: "MultiPolygon", coordinates: polygons };
}

export async function queryArcgisFeatureLayer<A = Record<string, unknown>>(
  baseUrl: string,
  bbox: [number, number, number, number],
  outFields = "*",
  timeoutMs = 9_000,
): Promise<EsriFeature<A>[]> {
  const [xmin, ymin, xmax, ymax] = bbox;
  const params = new URLSearchParams({
    where: "1=1",
    geometry: JSON.stringify({ xmin, ymin, xmax, ymax, spatialReference: { wkid: 4326 } }),
    geometryType: "esriGeometryEnvelope",
    inSR: "4326",
    outSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    outFields,
    returnGeometry: "true",
    f: "json",
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${baseUrl}/query?${params.toString()}`, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as EsriQueryResponse<A>;
    if (data.error) return [];
    return data.features ?? [];
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}
