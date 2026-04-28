import type { LocationOption } from "../types";

const DEFAULT_STARTER: LocationOption = {
  id: 1,
  name: "Vancouver",
  admin1: "British Columbia",
  country: "Canada",
  latitude: 49.2497,
  longitude: -123.1193,
  timezone: "America/Vancouver",
};

export type StarterEnv = {
  VITE_STARTER_LATITUDE?: string;
  VITE_STARTER_LONGITUDE?: string;
  VITE_STARTER_NAME?: string;
  VITE_STARTER_ADMIN1?: string;
  VITE_STARTER_COUNTRY?: string;
  VITE_STARTER_TIMEZONE?: string;
};

export function resolveStarterLocation(env: StarterEnv): LocationOption {
  const lat = Number(env.VITE_STARTER_LATITUDE);
  const lon = Number(env.VITE_STARTER_LONGITUDE);

  const hasValidCoords =
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    lat >= -90 &&
    lat <= 90 &&
    lon >= -180 &&
    lon <= 180 &&
    env.VITE_STARTER_LATITUDE !== undefined &&
    env.VITE_STARTER_LONGITUDE !== undefined;

  if (!hasValidCoords) {
    return DEFAULT_STARTER;
  }

  return {
    id: 1,
    name: env.VITE_STARTER_NAME?.trim() || "Starter location",
    admin1: env.VITE_STARTER_ADMIN1?.trim() || undefined,
    country: env.VITE_STARTER_COUNTRY?.trim() || "",
    latitude: lat,
    longitude: lon,
    timezone: env.VITE_STARTER_TIMEZONE?.trim() || undefined,
  };
}
