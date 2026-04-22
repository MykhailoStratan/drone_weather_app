import { useCallback } from "react";
import type { LocationOption } from "../types";

function coordsToId(lat: number, lon: number): number {
  return Math.abs(Math.round(lat * 1000) * 10000 + Math.round(lon * 1000)) || 1;
}

export function useUrlLocation() {
  const readLocationFromUrl = useCallback((): LocationOption | null => {
    const params = new URLSearchParams(window.location.search);
    const lat = parseFloat(params.get("lat") ?? "");
    const lon = parseFloat(params.get("lon") ?? "");
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

    return {
      id: coordsToId(lat, lon),
      name: params.get("name") ?? "Shared location",
      admin1: params.get("admin1") ?? undefined,
      country: params.get("country") ?? "Unknown",
      latitude: lat,
      longitude: lon,
      timezone: params.get("tz") ?? undefined,
    };
  }, []);

  const writeLocationToUrl = useCallback((location: LocationOption) => {
    const params = new URLSearchParams();
    params.set("lat", location.latitude.toFixed(6));
    params.set("lon", location.longitude.toFixed(6));
    params.set("name", location.name);
    if (location.admin1) params.set("admin1", location.admin1);
    if (location.country) params.set("country", location.country);
    if (location.timezone) params.set("tz", location.timezone);
    window.history.replaceState(null, "", `?${params.toString()}`);
  }, []);

  return { readLocationFromUrl, writeLocationToUrl };
}
