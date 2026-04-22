import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { WeatherPayload, WeatherSnapshot } from "../types";
import { useDailyWeatherSlice } from "./useDailyWeatherSlice";

function snapshot(time: string, temperature: number): WeatherSnapshot {
  return {
    time,
    temperature,
    windSpeed: 8,
    windGusts: 12,
    windDirection: 180,
    precipitationAmount: 0,
    precipitationProbability: 10,
    cloudCover: 20,
    visibility: 12000,
    pressure: 1012,
    weatherCode: 0,
    isDay: 1,
  };
}

function daily(date: string) {
  return {
    date,
    sunrise: `${date}T06:00`,
    sunset: `${date}T20:00`,
    temperatureMax: 14,
    temperatureMin: 5,
    windSpeedMax: 12,
    windGustsMax: 18,
    precipitationProbabilityMax: 20,
    precipitationHours: 1,
    precipitationSum: 0.5,
    weatherCode: 0,
  };
}

const weather: WeatherPayload = {
  locationLabel: "Vancouver, British Columbia, Canada",
  timezone: "America/Vancouver",
  latitude: 49.2497,
  longitude: -123.1193,
  current: snapshot("2026-04-15T12:00", 12),
  hourly: [
    snapshot("2026-04-14T23:00", 7),
    snapshot("2026-04-15T00:00", 8),
    snapshot("2026-04-15T12:00", 12),
    snapshot("2026-04-16T00:00", 9),
  ],
  daily: [daily("2026-04-14"), daily("2026-04-15"), daily("2026-04-16")],
  alerts: [],
};

describe("useDailyWeatherSlice", () => {
  it("returns current, previous, and next day hourly slices", () => {
    const { result } = renderHook(() => useDailyWeatherSlice(weather, "2026-04-15"));

    expect(result.current.currentDay?.date).toBe("2026-04-15");
    expect(result.current.hourlyForDay.map((entry) => entry.time)).toEqual([
      "2026-04-15T00:00",
      "2026-04-15T12:00",
    ]);
    expect(result.current.prevDayHourly.map((entry) => entry.time)).toEqual(["2026-04-14T23:00"]);
    expect(result.current.nextDayHourly.map((entry) => entry.time)).toEqual(["2026-04-16T00:00"]);
  });

  it("falls back to the first daily entry when the selected date is missing", () => {
    const { result } = renderHook(() => useDailyWeatherSlice(weather, "2026-04-17"));

    expect(result.current.currentDay?.date).toBe("2026-04-14");
    expect(result.current.hourlyForDay).toEqual([]);
  });

  it("returns empty slices when weather is unavailable", () => {
    const { result } = renderHook(() => useDailyWeatherSlice(null, "2026-04-15"));

    expect(result.current.currentDay).toBeUndefined();
    expect(result.current.hourlyForDay).toEqual([]);
    expect(result.current.prevDayHourly).toEqual([]);
    expect(result.current.nextDayHourly).toEqual([]);
  });
});
