import { degreesToRadians, ecfToLookAngles, eciToEcf, gstime, propagate, twoline2satrec } from "satellite.js";
import type { GnssEnvironmentPreset, GnssEstimateRequest, GnssEstimateResponse, WeatherQuery } from "../../../packages/weather-domain/src";
import { CACHE_TTLS, getCached, setCached } from "./cache";
import { createGnssEstimateResponse } from "./contracts";

const CELESTRAK_URL = "https://celestrak.org/NORAD/elements/gp.php";
const NOAA_SCALES_URL = "https://services.swpc.noaa.gov/products/noaa-scales.json";
const NOAA_KP_URL = "https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json";

type SpaceWeatherSnapshot = {
  kpIndex: number;
  geomagneticScale: number;
};

type TleRecord = {
  name: string;
  line1: string;
  line2: string;
};

const CONSTELLATION_GROUPS = [
  { key: "gps", group: "gps-ops" },
  { key: "galileo", group: "galileo" },
  { key: "glonass", group: "glonass" },
] as const;

type ConstellationKey = (typeof CONSTELLATION_GROUPS)[number]["key"];

export async function fetchGnssEstimate(request: GnssEstimateRequest): Promise<GnssEstimateResponse> {
  const query = request.location;
  const [constellations, spaceWeather] = await Promise.all([fetchConstellationRecords(), fetchSpaceWeather()]);
  const counts = estimateSatelliteCounts(query, constellations);
  const scored = scoreGnssEstimate(request, counts, spaceWeather);

  return createGnssEstimateResponse({
    location: query,
    timezone: query.timezone ?? "auto",
    latitude: query.latitude,
    longitude: query.longitude,
    estimatedVisibleSatellites: scored.estimatedVisibleSatellites,
    estimatedUsableSatellites: scored.estimatedUsableSatellites,
    gnssScore: scored.gnssScore,
    summary: scored.summary,
    spaceWeatherPenalty: scored.spaceWeatherPenalty,
  });
}

export function scoreGnssEstimate(
  request: GnssEstimateRequest,
  counts: { visible: number; usable: number },
  spaceWeather: SpaceWeatherSnapshot,
) {
  const { weather, environment } = request;
  const visibilityKm = weather.visibilityMeters / 1000;

  let gnssScore = Math.min(100, 48 + counts.usable * 2.5 + counts.visible * 1.1);
  gnssScore -= environmentPenalty(environment);
  gnssScore -= Math.min(14, weather.cloudCover * 0.06);
  gnssScore -= visibilityKm < 10 ? (10 - visibilityKm) * 1.8 : 0;
  gnssScore -= Math.min(10, weather.precipitationProbability * 0.05);
  gnssScore -= Math.min(8, weather.precipitationSum * 1.8);

  const spaceWeatherPenalty = computeSpaceWeatherPenalty(spaceWeather);
  gnssScore -= spaceWeatherPenalty;
  gnssScore = Math.max(12, Math.round(gnssScore));

  const estimatedVisibleSatellites = counts.visible;
  const estimatedUsableSatellites = Math.max(0, Math.min(counts.usable, estimatedVisibleSatellites));

  return {
    estimatedVisibleSatellites,
    estimatedUsableSatellites,
    gnssScore,
    spaceWeatherPenalty,
    summary: buildGnssSummary({
      visible: estimatedVisibleSatellites,
      usable: estimatedUsableSatellites,
      score: gnssScore,
      environment,
      kpIndex: spaceWeather.kpIndex,
    }),
  };
}

function buildGnssSummary(args: {
  visible: number;
  usable: number;
  score: number;
  environment: GnssEnvironmentPreset;
  kpIndex: number;
}) {
  const environmentLabel = {
    open: "open-sky conditions",
    suburban: "suburban surroundings",
    urban: "urban obstruction",
    trees: "trees or hills nearby",
  } satisfies Record<GnssEnvironmentPreset, string>;

  if (args.score >= 85) {
    return `${args.visible} GNSS satellites are likely above the horizon, with about ${args.usable} in strong geometry for a quick lock under ${environmentLabel[args.environment]}.`;
  }
  if (args.score >= 70) {
    return `${args.visible} GNSS satellites are likely visible, with around ${args.usable} expected to be usable. ${environmentLabel[args.environment]} may slow acquisition slightly.`;
  }
  if (args.kpIndex >= 5) {
    return `Geomagnetic activity is elevated, so even with ${args.visible} visible satellites the usable lock may be less stable than normal.`;
  }
  return `${args.visible} GNSS satellites may be visible, but only about ${args.usable} look comfortably usable once ${environmentLabel[args.environment]} is factored in.`;
}

function environmentPenalty(environment: GnssEnvironmentPreset) {
  const penalties = {
    open: 0,
    suburban: 8,
    urban: 22,
    trees: 16,
  } satisfies Record<GnssEnvironmentPreset, number>;
  return penalties[environment];
}

function computeSpaceWeatherPenalty(spaceWeather: SpaceWeatherSnapshot) {
  return Math.min(20, Math.round(spaceWeather.kpIndex * 1.5 + spaceWeather.geomagneticScale * 2.5));
}

async function fetchConstellationRecords() {
  const cached = getCached<Record<ConstellationKey, TleRecord[]>>("gnss:constellations");
  if (cached) {
    return cached;
  }

  const records = Object.fromEntries(
    await Promise.all(
      CONSTELLATION_GROUPS.map(async ({ key, group }) => [key, await fetchTleGroup(group)]),
    ),
  ) as Record<ConstellationKey, TleRecord[]>;

  setCached("gnss:constellations", records, CACHE_TTLS.gnssConstellation);
  return records;
}

async function fetchTleGroup(group: string) {
  const url = new URL(CELESTRAK_URL);
  url.searchParams.set("GROUP", group);
  url.searchParams.set("FORMAT", "tle");

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Unable to fetch GNSS constellation data for ${group}.`);
  }

  const raw = await response.text();
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter(Boolean);

  const records: TleRecord[] = [];
  for (let index = 0; index < lines.length; index += 3) {
    const name = lines[index];
    const line1 = lines[index + 1];
    const line2 = lines[index + 2];
    if (name && line1?.startsWith("1 ") && line2?.startsWith("2 ")) {
      records.push({ name, line1, line2 });
    }
  }

  return records;
}

async function fetchSpaceWeather(): Promise<SpaceWeatherSnapshot> {
  const cached = getCached<SpaceWeatherSnapshot>("gnss:space-weather");
  if (cached) {
    return cached;
  }

  const [scaleResponse, kpResponse] = await Promise.all([fetch(NOAA_SCALES_URL), fetch(NOAA_KP_URL)]);
  if (!scaleResponse.ok || !kpResponse.ok) {
    throw new Error("Unable to fetch current space weather conditions.");
  }

  const scales = (await scaleResponse.json()) as Record<string, { G?: { Scale?: string | null } }>;
  const kpSeries = (await kpResponse.json()) as Array<{ Kp?: number }>;

  const currentScale = Number(scales["0"]?.G?.Scale ?? 0);
  const latestKp = kpSeries.at(-1)?.Kp ?? 0;
  const snapshot = {
    kpIndex: latestKp,
    geomagneticScale: Number.isFinite(currentScale) ? currentScale : 0,
  };

  setCached("gnss:space-weather", snapshot, CACHE_TTLS.gnssSpaceWeather);
  return snapshot;
}

function estimateSatelliteCounts(
  location: WeatherQuery,
  constellations: Record<ConstellationKey, TleRecord[]>,
) {
  const observer = {
    longitude: degreesToRadians(location.longitude),
    latitude: degreesToRadians(location.latitude),
    height: 0,
  };
  const now = new Date();
  const gmst = gstime(now);

  let visible = 0;
  let usable = 0;

  for (const records of Object.values(constellations)) {
    for (const record of records) {
      const satrec = twoline2satrec(record.line1, record.line2);
      const positionAndVelocity = propagate(satrec, now);
      if (!positionAndVelocity.position) {
        continue;
      }

      const positionEcf = eciToEcf(positionAndVelocity.position, gmst);
      const lookAngles = ecfToLookAngles(observer, positionEcf);
      const elevationDegrees = (lookAngles.elevation * 180) / Math.PI;

      if (elevationDegrees > 0) {
        visible += 1;
      }
      if (elevationDegrees >= 10) {
        usable += 1;
      }
    }
  }

  return { visible, usable };
}
