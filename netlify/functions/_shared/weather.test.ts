import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchWeatherFromProvider } from "./weather";

vi.mock("./provider", () => ({
  fetchOverviewBundle: vi.fn(),
  fetchTimelineBundle: vi.fn(),
  fetchUnitedStatesAlerts: vi.fn(),
  searchLocationsFromProvider: vi.fn(),
}));

import { fetchOverviewBundle, fetchTimelineBundle, fetchUnitedStatesAlerts } from "./provider";

const location = {
  id: 1,
  name: "Vancouver",
  country: "Canada",
  admin1: "British Columbia",
  latitude: 49.2497,
  longitude: -123.1193,
  timezone: "America/Vancouver",
};

describe("fetchWeatherFromProvider", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns a degraded payload when timeline and alerts fail", async () => {
    vi.mocked(fetchOverviewBundle).mockResolvedValue({
      timezone: "America/Vancouver",
      latitude: 49.2497,
      longitude: -123.1193,
      current: {
        time: "2026-04-16T09:00",
        temperature: 7,
        windSpeed: 9,
        windGusts: 14,
        windDirection: 120,
        precipitationAmount: 0,
        precipitationProbability: 10,
        cloudCover: 32,
        visibility: 10000,
        pressure: 1016,
        weatherCode: 1,
        isDay: 1,
      },
      today: {
        date: "2026-04-16",
        sunrise: "2026-04-16T06:10",
        sunset: "2026-04-16T20:05",
        temperatureMax: 12,
        temperatureMin: 4,
        windSpeedMax: 18,
        windGustsMax: 24,
        precipitationProbabilityMax: 20,
        precipitationHours: 1,
        precipitationSum: 0.2,
        weatherCode: 1,
      },
    });
    vi.mocked(fetchTimelineBundle).mockRejectedValue(new Error("timeline failed"));
    vi.mocked(fetchUnitedStatesAlerts).mockRejectedValue(new Error("alerts failed"));

    const payload = await fetchWeatherFromProvider(location);

    expect(payload.current.temperature).toBe(7);
    expect(payload.hourly).toEqual([]);
    expect(payload.daily).toHaveLength(1);
    expect(payload.daily[0]?.date).toBe("2026-04-16");
    expect(payload.alerts).toEqual([]);
  });

  it("throws when overview data is unavailable", async () => {
    vi.mocked(fetchOverviewBundle).mockRejectedValue(new Error("overview failed"));
    vi.mocked(fetchTimelineBundle).mockResolvedValue({
      timezone: "America/Vancouver",
      latitude: 49.2497,
      longitude: -123.1193,
      hourly: [],
      daily: [],
    });
    vi.mocked(fetchUnitedStatesAlerts).mockResolvedValue([]);

    await expect(fetchWeatherFromProvider(location)).rejects.toThrow("overview failed");
  });
});
