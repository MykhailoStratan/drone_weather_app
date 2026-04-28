import { describe, expect, it } from "vitest";
import { resolveStarterLocation } from "./starter-location";

describe("resolveStarterLocation", () => {
  it("returns the Vancouver default when no env is provided", () => {
    const location = resolveStarterLocation({});
    expect(location.name).toBe("Vancouver");
    expect(location.country).toBe("Canada");
    expect(location.latitude).toBeCloseTo(49.2497, 4);
    expect(location.longitude).toBeCloseTo(-123.1193, 4);
    expect(location.timezone).toBe("America/Vancouver");
  });

  it("returns the default when only one coord is set", () => {
    const result = resolveStarterLocation({ VITE_STARTER_LATITUDE: "35.6762" });
    expect(result.name).toBe("Vancouver");
  });

  it("returns the default when coords are invalid", () => {
    const result = resolveStarterLocation({
      VITE_STARTER_LATITUDE: "not-a-number",
      VITE_STARTER_LONGITUDE: "139.6503",
    });
    expect(result.name).toBe("Vancouver");
  });

  it("returns the default when coords are out of range", () => {
    const result = resolveStarterLocation({
      VITE_STARTER_LATITUDE: "120",
      VITE_STARTER_LONGITUDE: "0",
    });
    expect(result.name).toBe("Vancouver");
  });

  it("uses configured coords with the provided name and metadata", () => {
    const result = resolveStarterLocation({
      VITE_STARTER_LATITUDE: "35.6762",
      VITE_STARTER_LONGITUDE: "139.6503",
      VITE_STARTER_NAME: "Tokyo",
      VITE_STARTER_COUNTRY: "Japan",
      VITE_STARTER_TIMEZONE: "Asia/Tokyo",
    });
    expect(result.name).toBe("Tokyo");
    expect(result.country).toBe("Japan");
    expect(result.latitude).toBeCloseTo(35.6762, 4);
    expect(result.longitude).toBeCloseTo(139.6503, 4);
    expect(result.timezone).toBe("Asia/Tokyo");
  });

  it("falls back to a generic name when only coords are configured", () => {
    const result = resolveStarterLocation({
      VITE_STARTER_LATITUDE: "0",
      VITE_STARTER_LONGITUDE: "0",
    });
    expect(result.name).toBe("Starter location");
    expect(result.latitude).toBe(0);
    expect(result.longitude).toBe(0);
  });

  it("trims whitespace and ignores empty admin1 / timezone", () => {
    const result = resolveStarterLocation({
      VITE_STARTER_LATITUDE: "51.5074",
      VITE_STARTER_LONGITUDE: "-0.1278",
      VITE_STARTER_NAME: "  London  ",
      VITE_STARTER_ADMIN1: "   ",
      VITE_STARTER_TIMEZONE: "",
    });
    expect(result.name).toBe("London");
    expect(result.admin1).toBeUndefined();
    expect(result.timezone).toBeUndefined();
  });
});
