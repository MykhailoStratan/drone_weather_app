import type { LocationOption, WeatherPayload } from "../types";

export async function searchLocations(query: string): Promise<LocationOption[]> {
  if (query.trim().length < 2) {
    return [];
  }

  const response = await fetch(`/api/locations?query=${encodeURIComponent(query.trim())}`);
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
