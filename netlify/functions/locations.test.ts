import { afterEach, describe, expect, it, vi } from "vitest";
import handler from "./locations";

vi.mock("./_shared/weather", () => ({
  searchLocationsFromProvider: vi.fn(),
}));

import { searchLocationsFromProvider } from "./_shared/weather";

describe("locations function", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 400 for invalid search queries without calling the provider", async () => {
    const response = await handler(new Request("https://example.com/api/v1/locations?query=New%0AYork"));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid location query." });
    expect(searchLocationsFromProvider).not.toHaveBeenCalled();
  });

  it("returns provider results for valid multilingual queries", async () => {
    vi.mocked(searchLocationsFromProvider).mockResolvedValue([
      {
        id: 1,
        name: "Москва",
        country: "Russia",
        latitude: 55.7558,
        longitude: 37.6173,
        timezone: "Europe/Moscow",
      },
    ]);

    const response = await handler(new Request("https://example.com/api/v1/locations?query=%D0%9C%D0%BE%D1%81%D0%BA%D0%B2%D0%B0"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([
      {
        id: 1,
        name: "Москва",
        country: "Russia",
        latitude: 55.7558,
        longitude: 37.6173,
        timezone: "Europe/Moscow",
      },
    ]);
    expect(searchLocationsFromProvider).toHaveBeenCalledWith("Москва");
  });
});
