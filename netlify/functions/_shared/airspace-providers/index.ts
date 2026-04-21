import type {
  AirspaceCountry,
  AirspaceFeature,
  TFRFeature,
} from "../../../../packages/weather-domain/src/types";
import { detectCountry } from "./geo";
import { fetchFaaAirspace, fetchFaaTfrs } from "./faa";
import { fetchCanadaAirspace } from "./canada";
import { fetchJapanAirspace } from "./japan";
import { fetchOpenAipAirspace } from "./openaip";
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

function readOpenAipClientId(): string {
  const netlifyEnv = (globalThis as {
    Netlify?: { env?: { get?: (name: string) => string | undefined } };
  }).Netlify?.env;
  const keys = ["OPENAIP_CLIENT_ID", "OPENAIP_API_KEY", "OPENAIP_TOKEN"];

  for (const key of keys) {
    const value = netlifyEnv?.get?.(key) ?? process.env[key];
    if (value?.trim()) return value.trim();
  }

  return "";
}

export async function fetchAirspaceBundle(
  lat: number,
  lng: number,
  countryHint?: string,
): Promise<AirspaceBundle> {
  const country = detectCountry(lat, lng, countryHint);
  const openAipKey = readOpenAipClientId();
  const openAipTask = openAipKey
    ? safely("OpenAIP", fetchOpenAipAirspace(lat, lng, openAipKey))
    : Promise.resolve(null);

  if (country === "US") {
    const [faa, tfrs, openAip, fallback] = await Promise.all([
      safely("FAA", fetchFaaAirspace(lat, lng)),
      safely("TFR", fetchFaaTfrs(lat, lng)),
      openAipTask,
      safely("Overpass (US fallback)", fetchOverpassAirspace(lat, lng)),
    ]);
    const openAipSource = openAip?.length ? ["OpenAIP"] : [];
    return {
      country,
      dataSources: ["FAA ArcGIS (Class & Special Use)", ...openAipSource, "aviationweather.gov TFR", "OSM Overpass"],
      features: mergeFeatures([...(faa ?? []), ...(openAip ?? [])], fallback ?? []),
      tfrs: tfrs ?? [],
    };
  }

  if (country === "CA") {
    const [tc, openAip, fallback] = await Promise.all([
      safely("Transport Canada", fetchCanadaAirspace(lat, lng)),
      openAipTask,
      safely("Overpass (CA fallback)", fetchOverpassAirspace(lat, lng)),
    ]);
    const openAipSource = openAip?.length ? ["OpenAIP"] : [];
    return {
      country,
      dataSources: ["Transport Canada airports (geo.ca)", ...openAipSource, "OSM Overpass"],
      features: mergeFeatures([...(tc ?? []), ...(openAip ?? [])], fallback ?? []),
      tfrs: [],
    };
  }

  if (country === "JP") {
    const [jp, openAip] = await Promise.all([
      safely("Japan", fetchJapanAirspace(lat, lng)),
      openAipTask,
    ]);
    const openAipSource = openAip?.length ? ["OpenAIP"] : [];
    return {
      country,
      dataSources: ["OSM Overpass (Japan) + Civil Aeronautics Act 9 km rule", ...openAipSource],
      features: mergeFeatures(openAip ?? [], jp ?? []),
      tfrs: [],
    };
  }

  const [openAip, fallback] = await Promise.all([
    openAipTask,
    safely("Overpass (default)", fetchOverpassAirspace(lat, lng)),
  ]);
  const openAipSource = openAip?.length ? ["OpenAIP"] : [];
  return {
    country,
    dataSources: [...openAipSource, "OSM Overpass (worldwide fallback)"],
    features: mergeFeatures(openAip ?? [], fallback ?? []),
    tfrs: [],
  };
}
