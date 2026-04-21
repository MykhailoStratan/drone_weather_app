import { useEffect, useState } from "react";
import { defaultPreferences, readStoredPreferences, storePreferences } from "../lib/storage";

export type Preferences = {
  theme: "dark" | "light";
  temperatureUnit: "c" | "f";
  windUnit: "kmh" | "mph";
  visibilityUnit: "km" | "mi";
  hourCycle: "12h" | "24h";
};

export function usePreferences() {
  const [preferences, setPreferences] = useState<Preferences>(() => readStoredPreferences());
  const [preferencesOpen, setPreferencesOpen] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.theme = preferences.theme;
    document.documentElement.style.colorScheme = preferences.theme;
  }, [preferences.theme]);

  function updatePreferences(nextPreferences: Preferences) {
    setPreferences(nextPreferences);
    storePreferences(nextPreferences);
  }

  return {
    defaultPreferences,
    preferences,
    preferencesOpen,
    setPreferencesOpen,
    updatePreferences,
  };
}
