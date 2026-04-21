import type {
  AirspaceCountry,
  AirspaceFeature,
  TFRFeature,
} from "../../../../packages/weather-domain/src/types";
import { detectCountry } from "./geo";
import { fetchFaaAirspace, fetchFaaTfrs } from "./faa";
import { fetchCanadaAirspace } from "./canada";
import { fetchJapanAirspace } from "./japan";
import { fetchOverpassAirspace } from "./overpass";

export { detectCountry };

export type AirspaceBundle = {
  country: AirspaceCountry;
  dataSources: string[];
  features: AirspaceFeature[];
  tfrs: TFRFeature[];
};

// Deduplicate overlapping airports reported by both the country-specific provider
// and the OSM fallback, keyed by ICAO code or rounded coordinates.
function mergeFeatures(primary: AirspaceFeature[], fallback: AirspaceFeature[]): AirspaceFeature[] {
  const seen = new Set<string>();
  const keyFor = (f: AirspaceFeature) => {
    if (f.icao) return `icao:${f.icao.toUpperCase()}`;
    return `xy:${f.latitude.toFixed(2)}:${f.longitude.toFixed(2)}:${f.featureType}`;
  };
  const out: AirspaceFeature[] = [];
  for (const f of primary) {
    seen.add(keyFor(f));
    out.push(f);
  }
  for (const f of fallback) {
    const k = keyFor(f);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(f);
  }
  return out.sort((a, b) => a.distanceKm - b.distanceKm);
}

async function safely<T>(label: string, task: Promise<T>): Promise<T | null> {
  try {
    return await task;
  } catch (error) {
    console.warn(`[airspace] ${label} failed:`, error instanceof Error ? error.message : error);
    return null;
  }
}

export async function fetchAirspaceBundle(
  lat: number,
  lng: number,
  countryHint?: string,
): Promise<AirspaceBundle> {
  const country = detectCountry(lat, lng, countryHint);

  if (country === "US") {
    const [faa, tfrs, fallback] = await Promise.all([
      safely("FAA", fetchFaaAirspace(lat, lng)),
      safely("TFR", fetchFaaTfrs(lat, lng)),
      safely("Overpass (US fallback)", fetchOverpassAirspace(lat, lng)),
    ]);
    return {
      country,
      dataSources: ["FAA ArcGIS (Class & Special Use)", "aviationweather.gov TFR", "OSM Overpass"],
      features: mergeFeatures(faa ?? [], fallback ?? []),
      tfrs: tfrs ?? [],
    };
  }

  if (country === "CA") {
    const [tc, fallback] = await Promise.all([
      safely("Transport Canada", fetchCanadaAirspace(lat, lng)),
      safely("Overpass (CA fallback)", fetchOverpassAirspace(lat, lng)),
    ]);
    return {
      country,
      dataSources: ["Transport Canada airports (geo.ca)", "OSM Overpass"],
      features: mergeFeatures(tc ?? [], fallback ?? []),
      tfrs: [],
    };
  }

  if (country === "JP") {
    const jp = await safely("Japan", fetchJapanAirspace(lat, lng));
    return {
      country,
      dataSources: ["OSM Overpass (Japan) + Civil Aeronautics Act 9 km rule"],
      features: jp ?? [],
      tfrs: [],
    };
  }

  const fallback = await safely("Overpass (default)", fetchOverpassAirspace(lat, lng));
  return {
    country,
    dataSources: ["OSM Overpass (worldwide fallback)"],
    features: fallback ?? [],
    tfrs: [],
  };
}
