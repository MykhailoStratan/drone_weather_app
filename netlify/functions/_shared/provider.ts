import { z } from "zod";
import type { DailyWeather, LocationOption, WeatherAlert, WeatherSnapshot } from "../../../packages/weather-domain/src/types";

const GEO_URL = "https://geocoding-api.open-meteo.com/v1/search";
const WEATHER_URL = "https://api.open-meteo.com/v1/forecast";
const ALERTS_URL = "https://api.weather.gov/alerts/active";
const REQUEST_TIMEOUTS_MS = {
  geocoding: 3000,
  overview: 4000,
  timeline: 6500,
  alerts: 3000,
} as const;

const GeocodingResponseSchema = z.object({
  results: z.array(z.object({
    id: z.number(),
    name: z.string(),
    country: z.string(),
    admin1: z.string().optional(),
    latitude: z.number(),
    longitude: z.number(),
    timezone: z.string().optional(),
  })).optional(),
});

const WeatherSnapshotSchema = z.object({
  time: z.string(),
  temperature_2m: z.number(),
  wind_speed_10m: z.number(),
  wind_gusts_10m: z.number(),
  wind_direction_10m: z.number(),
  precipitation: z.number(),
  precipitation_probability: z.number(),
  cloud_cover: z.number(),
  visibility: z.number(),
  pressure_msl: z.number(),
  weather_code: z.number(),
  is_day: z.number(),
  relative_humidity_2m: z.number().optional(),
});

const HourlySchema = z.object({
  time: z.array(z.string()),
  temperature_2m: z.array(z.number()),
  wind_speed_10m: z.array(z.number()),
  wind_gusts_10m: z.array(z.number()),
  wind_direction_10m: z.array(z.number()),
  precipitation: z.array(z.number()),
  precipitation_probability: z.array(z.number()),
  cloud_cover: z.array(z.number()),
  visibility: z.array(z.number()),
  pressure_msl: z.array(z.number()),
  weather_code: z.array(z.number()),
  is_day: z.array(z.number()),
  relative_humidity_2m: z.array(z.number()).optional(),
});

const DailySchema = z.object({
  time: z.array(z.string()),
  sunrise: z.array(z.string()),
  sunset: z.array(z.string()),
  temperature_2m_max: z.array(z.number()),
  temperature_2m_min: z.array(z.number()),
  wind_speed_10m_max: z.array(z.number()),
  wind_gusts_10m_max: z.array(z.number()),
  precipitation_probability_max: z.array(z.number()),
  precipitation_hours: z.array(z.number()),
  precipitation_sum: z.array(z.number()),
  weather_code: z.array(z.number()),
});

const ForecastResponseSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  timezone: z.string(),
  current: WeatherSnapshotSchema.optional(),
  hourly: HourlySchema.optional(),
  daily: DailySchema.optional(),
});

const NwsAlertsResponseSchema = z.object({
  features: z.array(z.object({
    id: z.string(),
    properties: z.object({
      event: z.string().optional(),
      headline: z.string().optional(),
      severity: z.string().optional(),
      urgency: z.string().optional(),
      areaDesc: z.string().optional(),
      onset: z.string().optional(),
      effective: z.string().optional(),
      ends: z.string().optional(),
      expires: z.string().optional(),
    }),
  })).optional(),
});

type GeocodingResponse = z.infer<typeof GeocodingResponseSchema>;
type ForecastResponse = z.infer<typeof ForecastResponseSchema>;
type NwsAlertsResponse = z.infer<typeof NwsAlertsResponseSchema>;

export type ProviderOverviewBundle = {
  timezone: string;
  latitude: number;
  longitude: number;
  current: WeatherSnapshot;
  today: DailyWeather;
};

export type ProviderTimelineBundle = {
  timezone: string;
  latitude: number;
  longitude: number;
  hourly: WeatherSnapshot[];
  daily: DailyWeather[];
};

function logProviderRequest(label: string, startedAt: number, outcome: "ok" | "error") {
  console.info(`[weather-provider] ${label} ${outcome} ${Date.now() - startedAt}ms`);
}

async function fetchJsonWithTimeout<T>(
  input: string | URL,
  init: RequestInit,
  options: {
    label: string;
    timeoutMs: number;
    errorMessage: string;
    schema: z.ZodType<T>;
  },
): Promise<T> {
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs);

  try {
    const response = await fetch(input, {
      ...init,
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(options.errorMessage);
    }

    logProviderRequest(options.label, startedAt, "ok");
    return options.schema.parse(await response.json());
  } catch (error) {
    logProviderRequest(options.label, startedAt, "error");
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`${options.errorMessage} Request timed out.`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function toSnapshot(source: ForecastResponse["current"]): WeatherSnapshot {
  return {
    time: source.time,
    temperature: source.temperature_2m,
    windSpeed: source.wind_speed_10m,
    windGusts: source.wind_gusts_10m,
    windDirection: source.wind_direction_10m,
    precipitationAmount: source.precipitation,
    precipitationProbability: source.precipitation_probability,
    cloudCover: source.cloud_cover,
    visibility: source.visibility,
    pressure: source.pressure_msl,
    weatherCode: source.weather_code,
    isDay: source.is_day,
    relativeHumidity: source.relative_humidity_2m,
  };
}

function zipHourly(hourly: ForecastResponse["hourly"]): WeatherSnapshot[] {
  return hourly.time.map((time, index) => ({
    time,
    temperature: hourly.temperature_2m[index],
    windSpeed: hourly.wind_speed_10m[index],
    windGusts: hourly.wind_gusts_10m[index],
    windDirection: hourly.wind_direction_10m[index],
    precipitationAmount: hourly.precipitation[index],
    precipitationProbability: hourly.precipitation_probability[index],
    cloudCover: hourly.cloud_cover[index],
    visibility: hourly.visibility[index],
    pressure: hourly.pressure_msl[index],
    weatherCode: hourly.weather_code[index],
    isDay: hourly.is_day[index],
    relativeHumidity: hourly.relative_humidity_2m?.[index],
  }));
}

function zipDaily(daily: ForecastResponse["daily"]): DailyWeather[] {
  return daily.time.map((date, index) => ({
    date,
    sunrise: daily.sunrise[index],
    sunset: daily.sunset[index],
    temperatureMax: daily.temperature_2m_max[index],
    temperatureMin: daily.temperature_2m_min[index],
    windSpeedMax: daily.wind_speed_10m_max[index],
    windGustsMax: daily.wind_gusts_10m_max[index],
    precipitationProbabilityMax: daily.precipitation_probability_max[index],
    precipitationHours: daily.precipitation_hours[index],
    precipitationSum: daily.precipitation_sum[index],
    weatherCode: daily.weather_code[index],
  }));
}

export async function searchLocationsFromProvider(query: string): Promise<LocationOption[]> {
  const url = new URL(GEO_URL);
  url.searchParams.set("name", query.trim());
  url.searchParams.set("count", "6");
  url.searchParams.set("language", "en");
  url.searchParams.set("format", "json");

  const data = await fetchJsonWithTimeout(url, {}, {
    label: "locations",
    timeoutMs: REQUEST_TIMEOUTS_MS.geocoding,
    errorMessage: "Unable to search locations right now.",
    schema: GeocodingResponseSchema,
  });
  return (data.results ?? []).map((entry) => ({
    id: entry.id,
    name: entry.name,
    country: entry.country,
    admin1: entry.admin1,
    latitude: entry.latitude,
    longitude: entry.longitude,
    timezone: entry.timezone,
  }));
}

async function fetchForecastData(
  location: Pick<LocationOption, "latitude" | "longitude"> & Partial<LocationOption>,
  options: {
    forecastDays: number;
    pastDays: number;
    includeCurrent?: boolean;
    includeHourly?: boolean;
    includeDaily?: boolean;
    requestLabel: string;
    timeoutMs: number;
  },
) {
  const url = new URL(WEATHER_URL);
  url.searchParams.set("latitude", String(location.latitude));
  url.searchParams.set("longitude", String(location.longitude));
  url.searchParams.set("timezone", location.timezone ?? "auto");
  url.searchParams.set("forecast_days", String(options.forecastDays));
  url.searchParams.set("past_days", String(options.pastDays));

  if (options.includeCurrent) {
    url.searchParams.set(
      "current",
      [
        "temperature_2m",
        "wind_speed_10m",
        "wind_gusts_10m",
        "wind_direction_10m",
        "precipitation",
        "precipitation_probability",
        "cloud_cover",
        "visibility",
        "pressure_msl",
        "weather_code",
        "is_day",
        "relative_humidity_2m",
      ].join(","),
    );
  }
  if (options.includeHourly) {
    url.searchParams.set(
      "hourly",
      [
        "temperature_2m",
        "wind_speed_10m",
        "wind_gusts_10m",
        "wind_direction_10m",
        "precipitation",
        "precipitation_probability",
        "cloud_cover",
        "visibility",
        "pressure_msl",
        "weather_code",
        "is_day",
        "relative_humidity_2m",
      ].join(","),
    );
  }
  if (options.includeDaily) {
    url.searchParams.set(
      "daily",
      [
        "weather_code",
        "sunrise",
        "sunset",
        "temperature_2m_max",
        "temperature_2m_min",
        "wind_speed_10m_max",
        "wind_gusts_10m_max",
        "precipitation_probability_max",
        "precipitation_hours",
        "precipitation_sum",
      ].join(","),
    );
  }

  return fetchJsonWithTimeout(url, {}, {
    label: options.requestLabel,
    timeoutMs: options.timeoutMs,
    errorMessage: "Weather data is unavailable right now.",
    schema: ForecastResponseSchema,
  });
}

export async function fetchOverviewBundle(
  location: Pick<LocationOption, "latitude" | "longitude"> & Partial<LocationOption>,
): Promise<ProviderOverviewBundle> {
  const data = await fetchForecastData(location, {
    forecastDays: 1,
    pastDays: 0,
    includeCurrent: true,
    includeDaily: true,
    requestLabel: "overview",
    timeoutMs: REQUEST_TIMEOUTS_MS.overview,
  });

  if (!data.current || !data.daily) {
    throw new Error("Weather data is unavailable right now.");
  }
  return {
    timezone: data.timezone,
    latitude: data.latitude,
    longitude: data.longitude,
    current: toSnapshot(data.current),
    today: zipDaily(data.daily)[0],
  };
}

export async function fetchTimelineBundle(
  location: Pick<LocationOption, "latitude" | "longitude"> & Partial<LocationOption>,
): Promise<ProviderTimelineBundle> {
  const data = await fetchForecastData(location, {
    forecastDays: 7,
    pastDays: 7,
    includeHourly: true,
    includeDaily: true,
    requestLabel: "timeline",
    timeoutMs: REQUEST_TIMEOUTS_MS.timeline,
  });

  if (!data.hourly || !data.daily) {
    throw new Error("Weather data is unavailable right now.");
  }
  return {
    timezone: data.timezone,
    latitude: data.latitude,
    longitude: data.longitude,
    hourly: zipHourly(data.hourly),
    daily: zipDaily(data.daily),
  };
}

export async function fetchUnitedStatesAlerts(location: Partial<LocationOption> & Pick<LocationOption, "latitude" | "longitude">): Promise<WeatherAlert[]> {
  if (location.country !== "United States") {
    return [];
  }

  const url = new URL(ALERTS_URL);
  url.searchParams.set("point", `${location.latitude},${location.longitude}`);

  const data = await fetchJsonWithTimeout(
    url,
    {
      headers: {
        Accept: "application/geo+json",
        "User-Agent": "SkyCanvasWeather/1.0",
      },
    },
    {
      label: "alerts",
      timeoutMs: REQUEST_TIMEOUTS_MS.alerts,
      errorMessage: "Weather alerts are unavailable right now.",
      schema: NwsAlertsResponseSchema,
    },
  );

  return (data.features ?? []).map((feature) => ({
    id: feature.id,
    event: feature.properties.event ?? "Weather alert",
    headline: feature.properties.headline ?? "Active alert",
    severity: feature.properties.severity ?? "Unknown",
    urgency: feature.properties.urgency ?? "Unknown",
    area: feature.properties.areaDesc ?? "Affected area unavailable",
    startsAt: feature.properties.onset ?? feature.properties.effective,
    endsAt: feature.properties.ends ?? feature.properties.expires,
  }));
}
