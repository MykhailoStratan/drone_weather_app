import { afterEach, describe, expect, it, vi } from "vitest";
import { createSearchCacheKey, createWeatherCacheKey, getCacheState, setCached } from "./cache";

describe("weather cache helpers", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("builds stable weather cache keys from the request shape", () => {
    expect(
      createWeatherCacheKey("overview", {
        latitude: 49.2497,
        longitude: -123.1193,
        timezone: "America/Vancouver",
        country: "Canada",
      }),
    ).toBe("overview:49.2497:-123.1193:America/Vancouver:Canada");
  });

  it("tracks fresh and stale cache entries", () => {
    vi.useFakeTimers();
    setCached("forecast", { value: 1 }, 1000);

    expect(getCacheState<{ value: number }>("forecast")).toEqual({
      state: "fresh",
      value: { value: 1 },
    });

    vi.advanceTimersByTime(1001);

    expect(getCacheState<{ value: number }>("forecast")).toEqual({
      state: "stale",
      value: { value: 1 },
    });
  });

  it("normalizes location search cache keys", () => {
    expect(createSearchCacheKey("  VanCOUVer ")).toBe("locations:vancouver");
  });
});
