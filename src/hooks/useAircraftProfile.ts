import { useState } from "react";
import {
  aircraftProfilePresets,
  buildCustomAircraftProfile,
  defaultAircraftProfile,
  sanitizeAircraftProfile,
  type AircraftProfile,
} from "../lib/aircraftProfiles";

const AIRCRAFT_PROFILE_KEY = "skycanvas.aircraftProfile";

export function useAircraftProfile() {
  const [aircraftProfile, setAircraftProfile] = useState<AircraftProfile>(() => readStoredAircraftProfile());

  function updateAircraftProfile(nextProfile: AircraftProfile) {
    const sanitized = sanitizeAircraftProfile(nextProfile);
    setAircraftProfile(sanitized);
    storeAircraftProfile(sanitized);
  }

  function selectAircraftPreset(presetId: string) {
    const preset = aircraftProfilePresets.find((profile) => profile.id === presetId);
    if (preset) {
      updateAircraftProfile(preset);
      return;
    }

    updateAircraftProfile(buildCustomAircraftProfile(aircraftProfile));
  }

  return {
    aircraftProfile,
    aircraftProfilePresets,
    selectAircraftPreset,
    updateAircraftProfile,
  };
}

function readStoredAircraftProfile(): AircraftProfile {
  try {
    const raw = window.localStorage.getItem(AIRCRAFT_PROFILE_KEY);
    return raw ? sanitizeAircraftProfile(JSON.parse(raw) as Partial<AircraftProfile>) : defaultAircraftProfile;
  } catch {
    return defaultAircraftProfile;
  }
}

function storeAircraftProfile(profile: AircraftProfile) {
  window.localStorage.setItem(AIRCRAFT_PROFILE_KEY, JSON.stringify(profile));
}
