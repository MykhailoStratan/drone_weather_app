import { degreesToRadians, ecfToLookAngles, eciToEcf, gstime, propagate, twoline2satrec } from "satellite.js";
import type { GnssEnvironmentPreset, GnssEstimateRequest, GnssEstimateResponse, WeatherQuery } from "../../../packages/weather-domain/src";
import { CACHE_TTLS, getCacheState, setCached } from "./cache";
import { createGnssEstimateResponse, createUnavailableGnssEstimateResponse } from "./contracts";

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

const MAX_GNSS_SCORE = 100;
const MIN_GNSS_SCORE = 12;
const GNSS_BASE_SCORE = 48;
const USABLE_SAT_WEIGHT = 2.5;
const VISIBLE_SAT_WEIGHT = 1.1;
const MAX_CLOUD_PENALTY = 14;
const CLOUD_COVER_FACTOR = 0.06;
const MIN_GOOD_VISIBILITY_KM = 10;
const VISIBILITY_PENALTY_PER_KM = 1.8;
const MAX_PRECIP_PROB_PENALTY = 10;
const PRECIP_PROB_FACTOR = 0.05;
const MAX_PRECIP_SUM_PENALTY = 8;
const PRECIP_SUM_FACTOR = 1.8;
const KP_INDEX_FACTOR = 1.5;
const GEOMAGNETIC_SCALE_FACTOR = 2.5;
const MAX_SPACE_WEATHER_PENALTY = 20;
const USABLE_ELEVATION_DEG = 10;
const SCORE_EXCELLENT_THRESHOLD = 85;
const SCORE_GOOD_THRESHOLD = 70;
const KP_GEOMAGNETIC_STORM_THRESHOLD = 5;

const CONSTELLATION_GROUPS = [
  { key: "gps", group: "gps-ops" },
  { key: "galileo", group: "galileo" },
  { key: "glonass", group: "glonass" },
] as const;

type ConstellationKey = (typeof CONSTELLATION_GROUPS)[number]["key"];

export async function fetchGnssEstimate(request: GnssEstimateRequest): Promise<GnssEstimateResponse> {
  const query = request.location;
  let constellations: Record<ConstellationKey, TleRecord[]>;
  try {
    constellations = await fetchConstellationRecords();
  } catch (error) {
    const message = error instanceof Error ? error.message : "GNSS constellation data is unavailable.";
    return createUnavailableGnssEstimateResponse({
      location: query,
      timezone: query.timezone ?? "auto",
      latitude: query.latitude,
      longitude: query.longitude,
      summary: "GNSS data is not available right now. Satellite geometry could not be refreshed for this location.",
      unavailableReason: message,
    });
  }

  const spaceWeather = await fetchSpaceWeather();
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

  let gnssScore = Math.min(MAX_GNSS_SCORE, GNSS_BASE_SCORE + counts.usable * USABLE_SAT_WEIGHT + counts.visible * VISIBLE_SAT_WEIGHT);
  gnssScore -= environmentPenalty(environment);
  gnssScore -= Math.min(MAX_CLOUD_PENALTY, weather.cloudCover * CLOUD_COVER_FACTOR);
  gnssScore -= visibilityKm < MIN_GOOD_VISIBILITY_KM ? (MIN_GOOD_VISIBILITY_KM - visibilityKm) * VISIBILITY_PENALTY_PER_KM : 0;
  gnssScore -= Math.min(MAX_PRECIP_PROB_PENALTY, weather.precipitationProbability * PRECIP_PROB_FACTOR);
  gnssScore -= Math.min(MAX_PRECIP_SUM_PENALTY, weather.precipitationSum * PRECIP_SUM_FACTOR);

  const spaceWeatherPenalty = computeSpaceWeatherPenalty(spaceWeather);
  gnssScore -= spaceWeatherPenalty;
  gnssScore = Math.max(MIN_GNSS_SCORE, Math.round(gnssScore));

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

  if (args.score >= SCORE_EXCELLENT_THRESHOLD) {
    return `${args.visible} GNSS satellites are likely above the horizon, with about ${args.usable} in strong geometry for a quick lock under ${environmentLabel[args.environment]}.`;
  }
  if (args.score >= SCORE_GOOD_THRESHOLD) {
    return `${args.visible} GNSS satellites are likely visible, with around ${args.usable} expected to be usable. ${environmentLabel[args.environment]} may slow acquisition slightly.`;
  }
  if (args.kpIndex >= KP_GEOMAGNETIC_STORM_THRESHOLD) {
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
  return Math.min(MAX_SPACE_WEATHER_PENALTY, Math.round(spaceWeather.kpIndex * KP_INDEX_FACTOR + spaceWeather.geomagneticScale * GEOMAGNETIC_SCALE_FACTOR));
}

async function fetchConstellationRecords() {
  const cached = getCacheState<Record<ConstellationKey, TleRecord[]>>("gnss:constellations");
  if (cached.state === "fresh") {
    return cached.value;
  }

  try {
    const records = Object.fromEntries(
      await Promise.all(
        CONSTELLATION_GROUPS.map(async ({ key, group }) => [key, await fetchTleGroup(group)]),
      ),
    ) as Record<ConstellationKey, TleRecord[]>;

    setCached("gnss:constellations", records, CACHE_TTLS.gnssConstellation);
    return records;
  } catch (error) {
    const combinedFallback = await fetchCombinedConstellationFallback().catch(() => null);
    if (combinedFallback) {
      setCached("gnss:constellations", combinedFallback, CACHE_TTLS.gnssConstellation);
      return combinedFallback;
    }
    if (cached.state === "stale") {
      return cached.value;
    }
    throw error;
  }
}

async function fetchTleGroup(group: string) {
  const url = new URL(CELESTRAK_URL);
  url.searchParams.set("GROUP", group);
  url.searchParams.set("FORMAT", "tle");

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Unable to fetch GNSS constellation data for ${group}.`);
  }

  return parseTleRecords(await response.text());
}

async function fetchCombinedConstellationFallback() {
  const records = await fetchTleGroup("gnss");
  if (records.length === 0) {
    return null;
  }
  return {
    gps: records,
    galileo: [],
    glonass: [],
  } satisfies Record<ConstellationKey, TleRecord[]>;
}

function parseTleRecords(raw: string) {
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
  const cached = getCacheState<SpaceWeatherSnapshot>("gnss:space-weather");
  if (cached.state === "fresh") {
    return cached.value;
  }

  try {
    const [scaleResponse, kpResponse] = await Promise.all([
      fetch(NOAA_SCALES_URL),
      fetch(NOAA_KP_URL),
    ]);
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
  } catch {
    if (cached.state === "stale") {
      return cached.value;
    }
    return { kpIndex: 0, geomagneticScale: 0 };
  }
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
      if (elevationDegrees >= USABLE_ELEVATION_DEG) {
        usable += 1;
      }
    }
  }

  return { visible, usable };
}
