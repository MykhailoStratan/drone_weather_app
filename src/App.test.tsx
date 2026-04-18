import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import App from "./App";

const weatherPayload = {
  locationLabel: "Vancouver, British Columbia, Canada",
  timezone: "America/Vancouver",
  latitude: 49.2497,
  longitude: -123.1193,
};

const overviewPayload = {
  ...weatherPayload,
  current: {
    time: "2026-04-15T12:00",
    temperature: 4,
    windSpeed: 6,
    windGusts: 8,
    windDirection: 114,
    precipitationAmount: 0.4,
    precipitationProbability: 12,
    cloudCover: 31,
    visibility: 10000,
    pressure: 1015,
    weatherCode: 0,
    isDay: 1,
  },
  today: {
    date: "2026-04-15",
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
  },
};

const timelinePayload = {
  ...weatherPayload,
  hourly: Array.from({ length: 24 }, (_, index) => ({
    time: `2026-04-15T${String(index).padStart(2, "0")}:00`,
    temperature: 3 + index / 2,
    windSpeed: 5 + index / 3,
    windGusts: 7 + index / 3,
    windDirection: 90,
    precipitationAmount: index > 14 && index < 20 ? 0.8 : 0,
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

const alertsPayload = {
  ...weatherPayload,
  alerts: [],
};

const gnssPayload = {
  ...weatherPayload,
  fetchedAt: "2026-04-15T12:00:00.000Z",
  estimatedVisibleSatellites: 21,
  estimatedUsableSatellites: 15,
  gnssScore: 84,
  summary: "Strong GNSS visibility for this location.",
  spaceWeatherPenalty: 1,
};

describe("App preferences", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/weather/overview")) {
          return new Response(JSON.stringify(overviewPayload), { status: 200 });
        }

        if (url.includes("/weather/timeline")) {
          return new Response(JSON.stringify(timelinePayload), { status: 200 });
        }

        if (url.includes("/weather/alerts")) {
          return new Response(JSON.stringify(alertsPayload), { status: 200 });
        }

        if (url.includes("/gnss/estimate")) {
          return new Response(JSON.stringify(gnssPayload), { status: 200 });
        }

        if (url.includes("/locations")) {
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
    const view = render(<App />);

    expect(await view.findByRole("heading", { name: "Clear sky", level: 2 })).toBeTruthy();

    fireEvent.click(view.getByRole("button", { name: "Show" }));
    fireEvent.click(await view.findByRole("button", { name: "F" }));

    expect(document.querySelector(".temperature-unit")?.textContent).toBe("°F");
    view.unmount();
  });
});
