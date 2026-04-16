import type {
  DailyWeather,
  LocationOption,
  WeatherPayload,
  WeatherSnapshot,
} from "../../../packages/weather-domain/src/types";

const GEO_URL = "https://geocoding-api.open-meteo.com/v1/search";
const WEATHER_URL = "https://api.open-meteo.com/v1/forecast";

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

function toSnapshot(source: ForecastResponse["current"]): WeatherSnapshot {
  return {
    time: source.time,
    temperature: source.temperature_2m,
    windSpeed: source.wind_speed_10m,
    windGusts: source.wind_gusts_10m,
    windDirection: source.wind_direction_10m,
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

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Unable to search locations right now.");
  }

  const data = (await response.json()) as GeocodingResponse;
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

export async function fetchWeatherFromProvider(location: LocationOption): Promise<WeatherPayload> {
  const url = new URL(WEATHER_URL);
  url.searchParams.set("latitude", String(location.latitude));
  url.searchParams.set("longitude", String(location.longitude));
  url.searchParams.set("timezone", location.timezone ?? "auto");
  url.searchParams.set("forecast_days", "7");
  url.searchParams.set("past_days", "7");
  url.searchParams.set(
    "current",
    [
      "temperature_2m",
      "wind_speed_10m",
      "wind_gusts_10m",
      "wind_direction_10m",
      "precipitation_probability",
      "cloud_cover",
      "visibility",
      "pressure_msl",
      "weather_code",
      "is_day",
    ].join(","),
  );
  url.searchParams.set(
    "hourly",
    [
      "temperature_2m",
      "wind_speed_10m",
      "wind_gusts_10m",
      "wind_direction_10m",
      "precipitation_probability",
      "cloud_cover",
      "visibility",
      "pressure_msl",
      "weather_code",
      "is_day",
    ].join(","),
  );
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

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Weather data is unavailable right now.");
  }

  const data = (await response.json()) as ForecastResponse;

  return {
    locationLabel: [location.name, location.admin1, location.country].filter(Boolean).join(", "),
    timezone: data.timezone,
    latitude: data.latitude,
    longitude: data.longitude,
    current: toSnapshot(data.current),
    hourly: zipHourly(data.hourly),
    daily: zipDaily(data.daily),
  };
}
