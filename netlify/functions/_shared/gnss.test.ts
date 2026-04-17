import { describe, expect, it } from "vitest";
import { scoreGnssEstimate } from "./gnss";

describe("scoreGnssEstimate", () => {
  it("rewards stronger visible and usable geometry", () => {
    const request = {
      location: {
        latitude: 49.2497,
        longitude: -123.1193,
        timezone: "America/Vancouver",
        name: "Vancouver",
        country: "Canada",
      },
      environment: "open" as const,
      weather: {
        cloudCover: 12,
        visibilityMeters: 18000,
        precipitationProbability: 10,
        precipitationSum: 0,
        windGusts: 12,
      },
    };

    const result = scoreGnssEstimate(request, { visible: 23, usable: 16 }, { kpIndex: 1, geomagneticScale: 0 });

    expect(result.estimatedVisibleSatellites).toBe(23);
    expect(result.estimatedUsableSatellites).toBe(16);
    expect(result.gnssScore).toBeGreaterThan(80);
  });

  it("reduces score when environment and space weather are poor", () => {
    const request = {
      location: {
        latitude: 49.2497,
        longitude: -123.1193,
      },
      environment: "urban" as const,
      weather: {
        cloudCover: 90,
        visibilityMeters: 2500,
        precipitationProbability: 75,
        precipitationSum: 4,
        windGusts: 38,
      },
    };

    const result = scoreGnssEstimate(request, { visible: 18, usable: 9 }, { kpIndex: 5, geomagneticScale: 2 });

    expect(result.gnssScore).toBeLessThan(60);
    expect(result.summary).toContain("usable");
  });
});
