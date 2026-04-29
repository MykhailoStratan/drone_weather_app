import { describe, expect, it } from "vitest";
import { defaultAircraftProfile } from "./aircraftProfiles";
import { findBestFlightWindow, rateFlightHour } from "./bestFlightWindow";
import type { WeatherSnapshot } from "../types";

function makeSnapshot(time: string, overrides: Partial<WeatherSnapshot> = {}): WeatherSnapshot {
  return {
    time,
    temperature: 16,
    windSpeed: 8,
    windGusts: 12,
    windDirection: 90,
    precipitationAmount: 0,
    precipitationProbability: 5,
    cloudCover: 30,
    visibility: 12000,
    pressure: 1014,
    weatherCode: 0,
    isDay: 1,
    ...overrides,
  };
}

describe("best flight window", () => {
  it("selects the longest contiguous good daylight window", () => {
    const hourly = Array.from({ length: 8 }, (_, index) =>
      makeSnapshot(`2026-04-15T${String(index + 9).padStart(2, "0")}:00`),
    );
    hourly[1] = makeSnapshot("2026-04-15T10:00", { windGusts: 44 });
    hourly[5] = makeSnapshot("2026-04-15T14:00", { precipitationProbability: 70 });

    const bestWindow = findBestFlightWindow(hourly, defaultAircraftProfile);

    expect(bestWindow.type).toBe("window");
    if (bestWindow.type === "window") {
      expect(bestWindow.startTime).toBe("2026-04-15T11:00");
      expect(bestWindow.endTime).toBe("2026-04-15T14:00");
      expect(bestWindow.durationHours).toBe(3);
      expect(bestWindow.reasons).toEqual(["Profile limits clear through this window."]);
    }
  });

  it("returns the best fallback hour when every hour has a limiting factor", () => {
    const hourly = [
      makeSnapshot("2026-04-15T10:00", { windGusts: 55 }),
      makeSnapshot("2026-04-15T11:00", { precipitationProbability: 80 }),
      makeSnapshot("2026-04-15T12:00", { visibility: 4000 }),
    ];

    const bestWindow = findBestFlightWindow(hourly, defaultAircraftProfile);

    expect(bestWindow.type).toBe("fallback");
    if (bestWindow.type === "fallback") {
      expect(bestWindow.startTime).toBe("2026-04-15T12:00");
      expect(bestWindow.tone).toBe("caution");
      expect(bestWindow.reasons).toEqual(["visibility below 6 km"]);
    }
  });

  it("keeps night hours out of green recommendations", () => {
    const ratedHour = rateFlightHour(
      makeSnapshot("2026-04-15T22:00", { isDay: 0 }),
      defaultAircraftProfile,
    );

    expect(ratedHour.tone).toBe("caution");
    expect(ratedHour.reasons).toContain("outside daylight");
  });
});
