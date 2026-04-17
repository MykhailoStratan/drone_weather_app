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

type GeocodingResponse = {
  results?: Array<{
    id: number;
    name: string;
    country: string;
    admin1?: string;
    latitude: number;
    longitude: number;
    timezone?: string;
  }>;
};

type ForecastResponse = {
  latitude: number;
  longitude: number;
  timezone: string;
  current: {
    time: string;
    temperature_2m: number;
    wind_speed_10m: number;
    wind_gusts_10m: number;
    wind_direction_10m: number;
    precipitation: number;
    precipitation_probability: number;
    cloud_cover: number;
    visibility: number;
    pressure_msl: number;
    weather_code: number;
    is_day: number;
  };
  hourly: {
    time: string[];
    temperature_2m: number[];
    wind_speed_10m: number[];
    wind_gusts_10m: number[];
    wind_direction_10m: number[];
    precipitation: number[];
    precipitation_probability: number[];
    cloud_cover: number[];
    visibility: number[];
    pressure_msl: number[];
    weather_code: number[];
    is_day: number[];
  };
  daily: {
    time: string[];
    sunrise: string[];
    sunset: string[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    wind_speed_10m_max: number[];
    wind_gusts_10m_max: number[];
    precipitation_probability_max: number[];
    precipitation_hours: number[];
    precipitation_sum: number[];
    weather_code: number[];
  };
};

type NwsAlertsResponse = {
  features?: Array<{
    id: string;
    properties: {
      event?: string;
      headline?: string;
      severity?: string;
      urgency?: string;
      areaDesc?: string;
      onset?: string;
      effective?: string;
      ends?: string;
      expires?: string;
    };
  }>;
};

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
  },
) {
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
    return (await response.json()) as T;
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

  const data = await fetchJsonWithTimeout<GeocodingResponse>(url, {}, {
    label: "locations",
    timeoutMs: REQUEST_TIMEOUTS_MS.geocoding,
    errorMessage: "Unable to search locations right now.",
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

  return fetchJsonWithTimeout<ForecastResponse>(url, {}, {
    label: options.requestLabel,
    timeoutMs: options.timeoutMs,
    errorMessage: "Weather data is unavailable right now.",
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

  const data = await fetchJsonWithTimeout<NwsAlertsResponse>(
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
