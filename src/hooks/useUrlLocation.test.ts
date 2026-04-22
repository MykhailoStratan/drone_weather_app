import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useUrlLocation } from "./useUrlLocation";

describe("useUrlLocation", () => {
  it("reads a shared location from the query string", () => {
    window.history.pushState(
      null,
      "",
      "?lat=49.249700&lon=-123.119300&name=Vancouver&admin1=British+Columbia&country=Canada&tz=America%2FVancouver",
    );

    const { result } = renderHook(() => useUrlLocation());

    expect(result.current.readLocationFromUrl()).toEqual({
      id: 492376881,
      name: "Vancouver",
      admin1: "British Columbia",
      country: "Canada",
      latitude: 49.2497,
      longitude: -123.1193,
      timezone: "America/Vancouver",
    });
  });

  it("ignores invalid coordinates", () => {
    window.history.pushState(null, "", "?lat=not-a-number&lon=-123.119300");

    const { result } = renderHook(() => useUrlLocation());

    expect(result.current.readLocationFromUrl()).toBeNull();
  });

  it("writes the active location to the URL with stable precision", () => {
    window.history.pushState(null, "", "/");

    const { result } = renderHook(() => useUrlLocation());

    result.current.writeLocationToUrl({
      id: 1,
      name: "Victoria",
      admin1: "British Columbia",
      country: "Canada",
      latitude: 48.428421,
      longitude: -123.365644,
      timezone: "America/Vancouver",
    });

    const params = new URLSearchParams(window.location.search);
    expect(params.get("lat")).toBe("48.428421");
    expect(params.get("lon")).toBe("-123.365644");
    expect(params.get("name")).toBe("Victoria");
    expect(params.get("admin1")).toBe("British Columbia");
    expect(params.get("country")).toBe("Canada");
    expect(params.get("tz")).toBe("America/Vancouver");
  });
});
