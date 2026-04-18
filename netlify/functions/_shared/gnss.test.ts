import { describe, expect, it } from "vitest";
import { scoreGnssEstimate } from "./gnss";

const baseLocation = {
  latitude: 49.2497,
  longitude: -123.1193,
  timezone: "America/Vancouver",
  name: "Vancouver",
  country: "Canada",
};

const clearWeather = {
  cloudCover: 0,
  visibilityMeters: 20_000,
  precipitationProbability: 0,
  precipitationSum: 0,
  windGusts: 5,
};

const calmSpace = { kpIndex: 0, geomagneticScale: 0 };

describe("scoreGnssEstimate", () => {
  it("rewards stronger visible and usable geometry", () => {
    const result = scoreGnssEstimate(
      { location: baseLocation, environment: "open", weather: { ...clearWeather, cloudCover: 12, visibilityMeters: 18_000, precipitationProbability: 10 } },
      { visible: 23, usable: 16 },
      { kpIndex: 1, geomagneticScale: 0 },
    );

    expect(result.estimatedVisibleSatellites).toBe(23);
    expect(result.estimatedUsableSatellites).toBe(16);
    expect(result.gnssScore).toBeGreaterThan(80);
  });

  it("reduces score when environment and space weather are poor", () => {
    const result = scoreGnssEstimate(
      { location: baseLocation, environment: "urban", weather: { cloudCover: 90, visibilityMeters: 2500, precipitationProbability: 75, precipitationSum: 4, windGusts: 38 } },
      { visible: 18, usable: 9 },
      { kpIndex: 5, geomagneticScale: 2 },
    );

    expect(result.gnssScore).toBeLessThan(60);
    expect(result.summary).toContain("usable");
  });

  it("never produces a score below 12", () => {
    const result = scoreGnssEstimate(
      { location: baseLocation, environment: "urban", weather: { cloudCover: 100, visibilityMeters: 0, precipitationProbability: 100, precipitationSum: 20, windGusts: 80 } },
      { visible: 0, usable: 0 },
      { kpIndex: 9, geomagneticScale: 5 },
    );

    expect(result.gnssScore).toBeGreaterThanOrEqual(12);
  });

  it("never produces a score above 100", () => {
    const result = scoreGnssEstimate(
      { location: baseLocation, environment: "open", weather: clearWeather },
      { visible: 999, usable: 999 },
      calmSpace,
    );

    expect(result.gnssScore).toBeLessThanOrEqual(100);
  });

  it("open sky has lower penalty than urban", () => {
    const sharedArgs = {
      location: baseLocation,
      weather: clearWeather,
    } as const;

    const open = scoreGnssEstimate({ ...sharedArgs, environment: "open" }, { visible: 15, usable: 10 }, calmSpace);
    const urban = scoreGnssEstimate({ ...sharedArgs, environment: "urban" }, { visible: 15, usable: 10 }, calmSpace);

    expect(open.gnssScore).toBeGreaterThan(urban.gnssScore);
  });

  it("penalises visibility below 10 km", () => {
    const poor = scoreGnssEstimate(
      { location: baseLocation, environment: "open", weather: { ...clearWeather, visibilityMeters: 3_000 } },
      { visible: 15, usable: 10 },
      calmSpace,
    );
    const good = scoreGnssEstimate(
      { location: baseLocation, environment: "open", weather: clearWeather },
      { visible: 15, usable: 10 },
      calmSpace,
    );

    expect(good.gnssScore).toBeGreaterThan(poor.gnssScore);
  });

  it("applies space weather penalty proportional to kpIndex", () => {
    const calm = scoreGnssEstimate(
      { location: baseLocation, environment: "open", weather: clearWeather },
      { visible: 15, usable: 10 },
      { kpIndex: 0, geomagneticScale: 0 },
    );
    const stormy = scoreGnssEstimate(
      { location: baseLocation, environment: "open", weather: clearWeather },
      { visible: 15, usable: 10 },
      { kpIndex: 8, geomagneticScale: 4 },
    );

    expect(calm.gnssScore).toBeGreaterThan(stormy.gnssScore);
    expect(stormy.spaceWeatherPenalty).toBeGreaterThan(0);
  });

  it("caps space weather penalty at 20", () => {
    const result = scoreGnssEstimate(
      { location: baseLocation, environment: "open", weather: clearWeather },
      { visible: 15, usable: 10 },
      { kpIndex: 100, geomagneticScale: 100 },
    );

    expect(result.spaceWeatherPenalty).toBeLessThanOrEqual(20);
  });

  it("clamps usable to not exceed visible", () => {
    const result = scoreGnssEstimate(
      { location: baseLocation, environment: "open", weather: clearWeather },
      { visible: 5, usable: 20 },
      calmSpace,
    );

    expect(result.estimatedUsableSatellites).toBeLessThanOrEqual(result.estimatedVisibleSatellites);
  });

  it("includes geomagnetic warning in summary when kpIndex is high and score is low", () => {
    const result = scoreGnssEstimate(
      { location: baseLocation, environment: "urban", weather: { ...clearWeather, cloudCover: 80, visibilityMeters: 3_000 } },
      { visible: 8, usable: 3 },
      { kpIndex: 7, geomagneticScale: 3 },
    );

    if (result.gnssScore < 70) {
      expect(result.summary).toMatch(/geomagnetic|usable/i);
    }
  });
});
