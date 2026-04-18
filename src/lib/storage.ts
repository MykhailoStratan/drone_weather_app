import type { LocationOption, WeatherOverviewResponse } from "../types";

const SAVED_LOCATIONS_KEY = "skycanvas.savedLocations";
const LAST_OVERVIEW_KEY = "skycanvas.lastOverview";
const PREFERENCES_KEY = "skycanvas.preferences";

type Preferences = {
  theme: "dark" | "light";
  temperatureUnit: "c" | "f";
  windUnit: "kmh" | "mph";
  visibilityUnit: "km" | "mi";
  hourCycle: "12h" | "24h";
};

type CachedOverview = {
  savedAt: string;
  location: LocationOption;
  overview: WeatherOverviewResponse;
};

export const defaultPreferences: Preferences = {
  theme: "dark",
  temperatureUnit: "c",
  windUnit: "kmh",
  visibilityUnit: "km",
  hourCycle: "12h",
};

export function readStoredLocations(): LocationOption[] {
  try {
    const raw = window.localStorage.getItem(SAVED_LOCATIONS_KEY);
    return raw ? (JSON.parse(raw) as LocationOption[]) : [];
  } catch {
    return [];
  }
}

export function readStoredLocation(key: string): LocationOption | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as LocationOption) : null;
  } catch {
    return null;
  }
}

export function readStoredPreferences(): Preferences {
  try {
    const raw = window.localStorage.getItem(PREFERENCES_KEY);
    return raw
      ? { ...defaultPreferences, ...(JSON.parse(raw) as Partial<Preferences>) }
      : defaultPreferences;
  } catch {
    return defaultPreferences;
  }
}

export function readStoredOverview(): CachedOverview | null {
  try {
    const raw = window.localStorage.getItem(LAST_OVERVIEW_KEY);
    return raw ? (JSON.parse(raw) as CachedOverview) : null;
  } catch {
    return null;
  }
}

export function storeLocations(locations: LocationOption[]) {
  window.localStorage.setItem(SAVED_LOCATIONS_KEY, JSON.stringify(locations));
}

export function storeLocation(key: string, location: LocationOption) {
  window.localStorage.setItem(key, JSON.stringify(location));
}

export function storeOverview(location: LocationOption, overview: WeatherOverviewResponse) {
  const cached: CachedOverview = {
    savedAt: new Date().toISOString(),
    location,
    overview,
  };
  window.localStorage.setItem(LAST_OVERVIEW_KEY, JSON.stringify(cached));
}

export function storePreferences(preferences: Preferences) {
  window.localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences));
}

export function upsertLocation(locations: LocationOption[], next: LocationOption): LocationOption[] {
  return [next, ...locations.filter((l) => l.id !== next.id)].slice(0, 6);
}

export function buildWeatherFromOverview(overview: WeatherOverviewResponse) {
  return {
    locationLabel: overview.locationLabel,
    timezone: overview.timezone,
    latitude: overview.latitude,
    longitude: overview.longitude,
    current: overview.current,
    hourly: [] as [],
    daily: [overview.today],
    alerts: [] as [],
  };
}
