import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import App from "./App";

const weatherPayload = {
  locationLabel: "Vancouver, British Columbia, Canada",
  timezone: "America/Vancouver",
  latitude: 49.2497,
  longitude: -123.1193,
  alerts: [],
  current: {
    time: "2026-04-15T12:00",
    temperature: 4,
    windSpeed: 6,
    windGusts: 8,
    windDirection: 114,
    precipitationProbability: 12,
    cloudCover: 31,
    visibility: 10000,
    pressure: 1015,
    weatherCode: 0,
    isDay: 1,
  },
  hourly: Array.from({ length: 24 }, (_, index) => ({
    time: `2026-04-15T${String(index).padStart(2, "0")}:00`,
    temperature: 3 + index / 2,
    windSpeed: 5 + index / 3,
    windGusts: 7 + index / 3,
    windDirection: 90,
    precipitationProbability: index * 2,
    cloudCover: 20 + index,
    visibility: 10000,
    pressure: 1012,
    weatherCode: 0,
    isDay: index > 5 && index < 20 ? 1 : 0,
  })),
  daily: Array.from({ length: 14 }, (_, index) => ({
    date: `2026-04-${String(index + 9).padStart(2, "0")}`,
    sunrise: "2026-04-15T06:15",
    sunset: "2026-04-15T19:55",
    temperatureMax: 9,
    temperatureMin: 3,
    windSpeedMax: 12,
    windGustsMax: 18,
    precipitationProbabilityMax: 35,
    precipitationHours: 2,
    precipitationSum: 1.2,
    weatherCode: 0,
  })),
};

describe("App preferences", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/api/weather")) {
          return new Response(JSON.stringify(weatherPayload), { status: 200 });
        }

        if (url.includes("/api/locations")) {
          return new Response(JSON.stringify([]), { status: 200 });
        }

        return new Response(JSON.stringify({ error: "not found" }), { status: 404 });
      }),
    );
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("updates displayed temperature units when preferences change", async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Clear sky", level: 2 })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "F" }));

    await waitFor(() => {
      expect(screen.getByText("39")).toBeTruthy();
    });
  });
});
