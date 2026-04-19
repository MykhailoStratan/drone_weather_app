import type {
  AirspaceResponse,
  GnssEnvironmentPreset,
  GnssEstimateRequest,
  GnssEstimateResponse,
  LocationOption,
  WeatherAlertsResponse,
  WeatherOverviewResponse,
  WeatherPayload,
  WeatherTimelineResponse,
} from "../types";
import { validateLocationSearchQuery } from "../../packages/weather-domain/src/location-search";

const API_BASE = import.meta.env.VITE_API_BASE ?? "/api/v1";

export async function searchLocations(query: string): Promise<LocationOption[]> {
  const validation = validateLocationSearchQuery(query);
  if (!validation.valid) {
    return [];
  }

  const response = await fetch(`${API_BASE}/locations?query=${encodeURIComponent(validation.normalized)}`);
  if (!response.ok) {
    throw new Error("Unable to search locations right now.");
  }

  return (await response.json()) as LocationOption[];
}

export async function fetchWeather(location: LocationOption): Promise<WeatherPayload> {
  const response = await fetch("/api/weather", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(location),
  });
  if (!response.ok) {
    throw new Error("Weather data is unavailable right now.");
  }

  return (await response.json()) as WeatherPayload;
}

function buildWeatherQuery(location: LocationOption) {
  const params = new URLSearchParams({
    lat: String(location.latitude),
    lon: String(location.longitude),
  });

  if (location.timezone) {
    params.set("timezone", location.timezone);
  }
  if (location.name) {
    params.set("name", location.name);
  }
  if (location.admin1) {
    params.set("admin1", location.admin1);
  }
  if (location.country) {
    params.set("country", location.country);
  }

  return params.toString();
}

export async function fetchWeatherOverview(location: LocationOption): Promise<WeatherOverviewResponse> {
  const response = await fetch(`${API_BASE}/weather/overview?${buildWeatherQuery(location)}`);
  if (!response.ok) {
    throw new Error("Weather overview is unavailable right now.");
  }

  return (await response.json()) as WeatherOverviewResponse;
}

export async function fetchWeatherTimeline(location: LocationOption): Promise<WeatherTimelineResponse> {
  const response = await fetch(`${API_BASE}/weather/timeline?${buildWeatherQuery(location)}`);
  if (!response.ok) {
    throw new Error("Weather timeline is unavailable right now.");
  }

  return (await response.json()) as WeatherTimelineResponse;
}

export async function fetchWeatherAlerts(location: LocationOption): Promise<WeatherAlertsResponse> {
  const response = await fetch(`${API_BASE}/weather/alerts?${buildWeatherQuery(location)}`);
  if (!response.ok) {
    throw new Error("Weather alerts are unavailable right now.");
  }

  return (await response.json()) as WeatherAlertsResponse;
}

export async function fetchGnssEstimate(request: GnssEstimateRequest): Promise<GnssEstimateResponse> {
  const response = await fetch(`${API_BASE}/gnss/estimate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error("GNSS estimate is unavailable right now.");
  }

  return (await response.json()) as GnssEstimateResponse;
}

export async function fetchAirspace(location: Pick<LocationOption, "latitude" | "longitude">): Promise<AirspaceResponse> {
  const params = new URLSearchParams({
    lat: String(location.latitude),
    lng: String(location.longitude),
  });
  const response = await fetch(`${API_BASE}/airspace?${params}`);
  if (!response.ok) {
    throw new Error("Airspace data is unavailable right now.");
  }
  return (await response.json()) as AirspaceResponse;
}

export type { GnssEnvironmentPreset };
