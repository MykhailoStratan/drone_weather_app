export type BatteryAge = "new" | "used" | "aged";

export type AircraftProfile = {
  id: string;
  name: string;
  maxWindKmh: number;
  maxGustKmh: number;
  maxRainProbability: number;
  minTempC: number;
  maxTempC: number;
  reserveBatteryPct: number;
  payloadGrams: number;
  batteryAge: BatteryAge;
};

export const aircraftProfilePresets: AircraftProfile[] = [
  {
    id: "mini",
    name: "Compact camera drone",
    maxWindKmh: 29,
    maxGustKmh: 38,
    maxRainProbability: 30,
    minTempC: 0,
    maxTempC: 40,
    reserveBatteryPct: 25,
    payloadGrams: 0,
    batteryAge: "used",
  },
  {
    id: "standard",
    name: "Standard quadcopter",
    maxWindKmh: 36,
    maxGustKmh: 48,
    maxRainProbability: 40,
    minTempC: -5,
    maxTempC: 40,
    reserveBatteryPct: 25,
    payloadGrams: 0,
    batteryAge: "used",
  },
  {
    id: "payload",
    name: "Payload / heavy lift",
    maxWindKmh: 30,
    maxGustKmh: 40,
    maxRainProbability: 25,
    minTempC: 0,
    maxTempC: 35,
    reserveBatteryPct: 35,
    payloadGrams: 500,
    batteryAge: "used",
  },
];

export const defaultAircraftProfile: AircraftProfile = aircraftProfilePresets[1];

export function buildCustomAircraftProfile(base: AircraftProfile): AircraftProfile {
  return {
    ...base,
    id: "custom",
    name: "Custom aircraft",
  };
}

export function sanitizeAircraftProfile(profile: Partial<AircraftProfile> | null | undefined): AircraftProfile {
  const fallback = defaultAircraftProfile;
  if (!profile || typeof profile !== "object") return fallback;

  return {
    id: typeof profile.id === "string" && profile.id ? profile.id : fallback.id,
    name: typeof profile.name === "string" && profile.name ? profile.name : fallback.name,
    maxWindKmh: clampNumber(profile.maxWindKmh, 5, 80, fallback.maxWindKmh),
    maxGustKmh: clampNumber(profile.maxGustKmh, 8, 100, fallback.maxGustKmh),
    maxRainProbability: clampNumber(profile.maxRainProbability, 0, 100, fallback.maxRainProbability),
    minTempC: clampNumber(profile.minTempC, -30, 20, fallback.minTempC),
    maxTempC: clampNumber(profile.maxTempC, 20, 55, fallback.maxTempC),
    reserveBatteryPct: clampNumber(profile.reserveBatteryPct, 10, 60, fallback.reserveBatteryPct),
    payloadGrams: clampNumber(profile.payloadGrams, 0, 5000, fallback.payloadGrams),
    batteryAge:
      profile.batteryAge === "new" || profile.batteryAge === "used" || profile.batteryAge === "aged"
        ? profile.batteryAge
        : fallback.batteryAge,
  };
}

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  const numberValue = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numberValue)) return fallback;
  return Math.min(max, Math.max(min, Math.round(numberValue)));
}
