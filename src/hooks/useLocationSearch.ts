import { useEffect, useRef, useState } from "react";
import { validateLocationSearchQuery } from "../../packages/weather-domain/src/location-search";
import { readStoredLocations, storeLocations, upsertLocation } from "../lib/storage";
import { searchLocations } from "../lib/weather";
import type { LocationOption } from "../types";

function roundCoord(value: number) {
  return Math.round(value * 100) / 100;
}

function createCurrentLocation(latitude: number, longitude: number): LocationOption {
  return {
    id: 0,
    name: "Current location",
    country: "Detected by device",
    latitude: roundCoord(latitude),
    longitude: roundCoord(longitude),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
}

type UseLocationSearchArgs = {
  activeLocation: LocationOption | null;
  loadWeather: (location: LocationOption) => Promise<void>;
  setLoading: (loading: boolean) => void;
  setMessage: (message: string) => void;
};

export function useLocationSearch({
  activeLocation,
  loadWeather,
  setLoading,
  setMessage,
}: UseLocationSearchArgs) {
  const [query, setQuery] = useState("Vancouver");
  const [results, setResults] = useState<LocationOption[]>([]);
  const [savedLocations, setSavedLocations] = useState<LocationOption[]>(() => readStoredLocations());
  const [searchOpen, setSearchOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const debounce = useRef<number | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (debounce.current) {
      window.clearTimeout(debounce.current);
    }

    if (query.trim().length < 2) {
      setResults([]);
      return;
    }

    if (!validateLocationSearchQuery(query).valid) {
      setResults([]);
      return;
    }

    debounce.current = window.setTimeout(() => {
      void loadSearchResults(query);
    }, 250);

    return () => {
      if (debounce.current) {
        window.clearTimeout(debounce.current);
      }
    };
  }, [query]);

  async function loadSearchResults(value: string) {
    const validation = validateLocationSearchQuery(value);
    if (!validation.valid) {
      setResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    try {
      const matches = await searchLocations(validation.normalized);
      setResults(matches);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to search locations.");
    } finally {
      setSearching(false);
    }
  }

  function requestCurrentLocation() {
    if (!navigator.geolocation) {
      setMessage("Geolocation is not supported by this browser.");
      return;
    }

    setLoading(true);
    setMessage("");

    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        await loadWeather(createCurrentLocation(coords.latitude, coords.longitude));
      },
      () => {
        setLoading(false);
        setSearchOpen(true);
        setMessage("Location permission was denied. Search for a place instead.");
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  function saveActiveLocation() {
    if (!activeLocation || activeLocation.id === 0) {
      setMessage("Search for a city or region before saving a location.");
      return;
    }

    const nextLocations = upsertLocation(savedLocations, activeLocation);
    setSavedLocations(nextLocations);
    storeLocations(nextLocations);
    setMessage(`${activeLocation.name} saved.`);
  }

  function removeSavedLocation(locationId: number) {
    const nextLocations = savedLocations.filter((location) => location.id !== locationId);
    setSavedLocations(nextLocations);
    storeLocations(nextLocations);
  }

  function handleSavedLocationChange(locationId: number) {
    const nextLocation = savedLocations.find((location) => location.id === locationId);
    if (nextLocation) {
      void loadWeather(nextLocation);
    }
  }

  function focusSearchInput() {
    setSearchOpen(true);
    searchInputRef.current?.focus();
    setMessage("Search for a city or region to try another forecast.");
  }

  return {
    query,
    results,
    savedLocations,
    searchInputRef,
    searchOpen,
    searching,
    focusSearchInput,
    handleSavedLocationChange,
    removeSavedLocation,
    requestCurrentLocation,
    saveActiveLocation,
    setQuery,
    setResults,
    setSavedLocations,
    setSearchOpen,
  };
}
