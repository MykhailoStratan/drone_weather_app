import { describe, expect, it, vi, afterEach } from "vitest";
import { fetchTimelineBundle } from "./provider";

describe("fetchTimelineBundle", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("requests only supported hourly fields from Open-Meteo", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          latitude: 49.2497,
          longitude: -123.1193,
          timezone: "America/Vancouver",
          hourly: {
            time: ["2026-04-19T10:00"],
            temperature_2m: [12],
            wind_speed_10m: [9],
            wind_gusts_10m: [15],
            wind_direction_10m: [180],
            wind_speed_80m: [12],
            wind_direction_80m: [190],
            wind_speed_120m: [14],
            wind_direction_120m: [200],
            precipitation: [0],
            precipitation_probability: [15],
            cloud_cover: [35],
            visibility: [10000],
            pressure_msl: [1015],
            weather_code: [1],
            is_day: [1],
            relative_humidity_2m: [66],
          },
          daily: {
            time: ["2026-04-19"],
            sunrise: ["2026-04-19T06:12"],
            sunset: ["2026-04-19T20:08"],
            temperature_2m_max: [14],
            temperature_2m_min: [6],
            wind_speed_10m_max: [18],
            wind_gusts_10m_max: [24],
            precipitation_probability_max: [20],
            precipitation_hours: [1],
            precipitation_sum: [0.4],
            weather_code: [1],
          },
        }),
      ),
    );

    await fetchTimelineBundle({
      latitude: 49.2497,
      longitude: -123.1193,
      timezone: "America/Vancouver",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [requestUrl] = fetchMock.mock.calls[0] ?? [];
    expect(requestUrl).toBeInstanceOf(URL);
    const hourly = (requestUrl as URL).searchParams.get("hourly");
    expect(hourly).toContain("wind_speed_80m");
    expect(hourly).toContain("wind_direction_120m");
    expect(hourly).not.toContain("wind_gusts_80m");
    expect(hourly).not.toContain("wind_gusts_120m");
    expect((requestUrl as URL).searchParams.get("past_days")).toBe("6");
    expect((requestUrl as URL).searchParams.get("forecast_days")).toBe("8");
  });
});
