import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

function createResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

function installFetchMock(options?: {
  overview?: Response | ((url: string, init?: RequestInit) => Response | Promise<Response>);
  timeline?: Response | ((url: string, init?: RequestInit) => Response | Promise<Response>);
  alerts?: Response | ((url: string, init?: RequestInit) => Response | Promise<Response>);
  locations?: Response | ((url: string, init?: RequestInit) => Response | Promise<Response>);
}) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);

    if (url.includes("/weather/overview")) {
      if (typeof options?.overview === "function") {
        return options.overview(url, init);
      }
      return options?.overview ?? createResponse(overviewPayload);
    }

    if (url.includes("/weather/timeline")) {
      if (typeof options?.timeline === "function") {
        return options.timeline(url, init);
      }
      return options?.timeline ?? createResponse(timelinePayload);
    }

    if (url.includes("/weather/alerts")) {
      if (typeof options?.alerts === "function") {
        return options.alerts(url, init);
      }
      return options?.alerts ?? createResponse(alertsPayload);
    }

    if (url.includes("/locations")) {
      if (typeof options?.locations === "function") {
        return options.locations(url, init);
      }
      return options?.locations ?? createResponse([]);
    }

    return createResponse({ error: "not found" }, 404);
  });

  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("App preferences", () => {
  beforeEach(() => {
    vi.spyOn(Date, "now").mockReturnValue(new Date("2026-04-15T12:00:00").getTime());
    installFetchMock();
    window.localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("updates displayed temperature units when preferences change", async () => {
    const view = render(<App />);

    expect(await view.findByRole("heading", { name: "Clear sky", level: 2 })).toBeTruthy();

    fireEvent.click(view.getByRole("button", { name: /12h/i }));
    fireEvent.click(await view.findByRole("button", { name: "F" }));

    expect(document.querySelector(".temperature-unit")?.textContent).toContain("F");
    view.unmount();
  });

  it("switches between dark and light themes", async () => {
    const view = render(<App />);

    expect(await view.findByRole("heading", { name: "Clear sky", level: 2 })).toBeTruthy();
    expect(document.documentElement.dataset.theme).toBe("dark");

    fireEvent.click(view.getByRole("button", { name: /12h/i }));
    fireEvent.click(await view.findByRole("button", { name: "Light" }));

    expect(document.documentElement.dataset.theme).toBe("light");
    view.unmount();
  });

  it("updates the hero card when the hour slider changes", async () => {
    const view = render(<App />);

    expect(await view.findByRole("heading", { name: "Clear sky", level: 2 })).toBeTruthy();

    const slider = await view.findByRole("slider", { name: "Select forecast hour" });
    expect(document.querySelector(".temperature-value")?.textContent).toBe("9");

    fireEvent.change(slider, { target: { value: "0" } });

    expect(document.querySelector(".temperature-value")?.textContent).toBe("3");
    view.unmount();
  });

  it("shows wind aloft right-side details only when gust data exists", async () => {
    installFetchMock({
      overview: createResponse({
        ...overviewPayload,
        current: {
          ...overviewPayload.current,
          windSpeed80m: 14,
          windDirection80m: 135,
          windSpeed120m: 18,
        },
      }),
      timeline: createResponse({ error: "timeline unavailable" }, 503),
    });

    const view = render(<App />);

    expect(await view.findByRole("heading", { name: "Clear sky", level: 2 })).toBeTruthy();

    const levels = Array.from(document.querySelectorAll(".wind-aloft-level"));
    expect(levels).toHaveLength(3);
    expect(document.querySelectorAll(".wind-aloft-gusts")).toHaveLength(1);
    expect(levels[0]?.querySelector(".wind-aloft-gusts")?.textContent).toContain("8");
    expect(document.querySelectorAll(".wind-aloft-dir")).toHaveLength(1);
    expect(levels[1]?.querySelector(".wind-aloft-gusts")).toBeNull();
    expect(levels[1]?.querySelector(".wind-aloft-dir")).toBeNull();
    expect(levels[2]?.querySelector(".wind-aloft-dir")).toBeNull();
    expect(levels[2]?.querySelector(".wind-aloft-gusts")).toBeNull();
    view.unmount();
  });

  it("bases flight readiness on weather factors only", async () => {
    installFetchMock({
      overview: createResponse({
        ...overviewPayload,
        today: {
          ...overviewPayload.today,
          windGustsMax: 34,
          precipitationProbabilityMax: 76,
        },
      }),
      timeline: createResponse({
        ...timelinePayload,
        hourly: timelinePayload.hourly.map((entry) => ({
          ...entry,
          temperature: -2,
          visibility: 2500,
          windGusts: 34,
        })),
        daily: timelinePayload.daily.map((day) => ({
          ...day,
          windGustsMax: 34,
          precipitationProbabilityMax: 76,
        })),
      }),
    });

    const view = render(<App />);

    expect(await view.findByRole("heading", { name: "Clear sky", level: 2 })).toBeTruthy();
    expect(view.getByRole("heading", { name: "Not recommended", level: 3 })).toBeTruthy();
    expect(view.getByText("Temperature")).toBeTruthy();
    expect(view.getByText("Extreme")).toBeTruthy();
    expect(document.querySelector(".readiness-summary")?.textContent).toContain("gusts are reaching 34");
    expect(document.querySelector(".readiness-summary")?.textContent).toContain("visibility is down to 2.5 km");
    expect(document.querySelector(".readiness-summary")?.textContent).toContain("76% rain potential");
    expect(document.querySelector(".readiness-summary")?.textContent).toContain("temperature is -2");
    expect(view.queryByText("GNSS")).toBeNull();
    expect(view.queryByText(/usable \/ visible/i)).toBeNull();
    view.unmount();
  });

  it("updates flight readiness wind data when the selected hour changes", async () => {
    installFetchMock({
      timeline: createResponse({
        ...timelinePayload,
        hourly: timelinePayload.hourly.map((entry, index) => ({
          ...entry,
          windGusts: index === 0 ? 42 : 10,
          windSpeed: index === 0 ? 28 : 6,
        })),
      }),
    });

    const view = render(<App />);

    expect(await view.findByRole("heading", { name: "Clear sky", level: 2 })).toBeTruthy();
    expect(view.getByText("10 km/h gusts")).toBeTruthy();
    expect(view.getByText("Visibility, wind, rain, and temperature are all within a comfortable range for a routine flight check.")).toBeTruthy();

    const slider = await view.findByRole("slider", { name: "Select forecast hour" });
    fireEvent.change(slider, { target: { value: "0" } });

    expect(view.getByText("42 km/h gusts")).toBeTruthy();
    expect(view.getByText("High")).toBeTruthy();
    expect(document.querySelector(".readiness-summary")?.textContent).toContain("gusts are reaching 42");
    view.unmount();
  });

  it("shows recoverable error UI when the initial overview request fails", async () => {
    installFetchMock({
      overview: createResponse({ error: "offline" }, 503),
    });

    const view = render(<App />);

    expect(await view.findByRole("heading", { name: "Forecast unavailable right now", level: 2 })).toBeTruthy();
    expect(view.queryByText("Pulling the latest forecast and recent history...")).toBeFalsy();
    expect((await view.findAllByRole("button", { name: "Retry" })).length).toBeGreaterThan(0);
    expect(view.getByLabelText("Search location")).toBeTruthy();
    view.unmount();
  });

  it("retries the failed requested location", async () => {
    const fetchMock = installFetchMock({
      overview: vi
        .fn()
        .mockResolvedValueOnce(createResponse({ error: "offline" }, 503))
        .mockResolvedValueOnce(createResponse(overviewPayload)),
    });

    const view = render(<App />);

    fireEvent.click((await view.findAllByRole("button", { name: "Retry" }))[0]);
    expect(await view.findByRole("heading", { name: "Clear sky", level: 2 })).toBeTruthy();

    const overviewCalls = fetchMock.mock.calls
      .map(([input]) => String(input))
      .filter((url) => url.includes("/weather/overview"));
    expect(overviewCalls).toHaveLength(2);
    expect(overviewCalls[0]).toContain("lat=49.2497");
    expect(overviewCalls[1]).toContain("lat=49.2497");
    view.unmount();
  });

  it("keeps search controls interactive after choosing to search for another location", async () => {
    installFetchMock({
      overview: createResponse({ error: "offline" }, 503),
    });

    const view = render(<App />);

    fireEvent.click((await view.findAllByRole("button", { name: "Search for another location" }))[0]);
    const input = view.getByLabelText("Search location") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "Tokyo" } });

    expect(input.value).toBe("Tokyo");
    expect(view.getByRole("button", { name: "Locate" })).toBeTruthy();
    view.unmount();
  });

  it("surfaces partial forecast failures while keeping weather visible", async () => {
    installFetchMock({
      timeline: createResponse({ error: "timeline unavailable" }, 503),
    });

    const view = render(<App />);

    expect(await view.findByRole("heading", { name: "Clear sky", level: 2 })).toBeTruthy();
    expect((await view.findAllByText("Weather timeline is unavailable right now.")).length).toBeGreaterThan(0);
    view.unmount();
  });

  it("rounds geolocation coordinates before requesting weather", async () => {
    const fetchMock = installFetchMock();
    Object.defineProperty(globalThis.navigator, "geolocation", {
      configurable: true,
      value: {
        getCurrentPosition: (success: (position: GeolocationPosition) => void) =>
          success({
            coords: {
              latitude: 49.2497123,
              longitude: -123.1193567,
            },
          } as GeolocationPosition),
      },
    });

    const view = render(<App />);

    expect(await view.findByRole("heading", { name: "Clear sky", level: 2 })).toBeTruthy();
    fireEvent.click(view.getByRole("button", { name: /Search .* Places/i }));
    fireEvent.click(view.getByRole("button", { name: "Locate" }));

    const geolocationCall = fetchMock.mock.calls
      .map(([input]) => String(input))
      .find((url) => url.includes("/weather/overview?lat=49.25&lon=-123.12"));
    expect(geolocationCall).toBeTruthy();
    view.unmount();
  });
});
