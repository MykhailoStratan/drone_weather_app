import { describe, expect, it } from "vitest";
import {
  bboxAround,
  bearingDeg,
  detectCountry,
  distanceKmToGeometry,
  haversineKm,
  pointInGeometry,
  polygonApproxRadiusKm,
} from "./geo";

describe("haversineKm", () => {
  it("computes zero distance for identical points", () => {
    expect(haversineKm(49.25, -123.12, 49.25, -123.12)).toBe(0);
  });

  it("matches Vancouver-Seattle great-circle distance within a few km", () => {
    const d = haversineKm(49.2497, -123.1193, 47.6062, -122.3321);
    expect(d).toBeGreaterThan(188);
    expect(d).toBeLessThan(196);
  });
});

describe("bearingDeg", () => {
  it("points east for due-east destinations", () => {
    const b = bearingDeg(49, -123, 49, -122);
    expect(b).toBeGreaterThan(88);
    expect(b).toBeLessThan(92);
  });

  it("normalizes into [0, 360)", () => {
    expect(bearingDeg(0, 0, -1, -1)).toBeGreaterThanOrEqual(0);
    expect(bearingDeg(0, 0, -1, -1)).toBeLessThan(360);
  });
});

describe("bboxAround", () => {
  it("returns a box whose diagonal spans approximately 2R kilometers", () => {
    const [minLng, minLat, maxLng, maxLat] = bboxAround(49.25, -123.12, 30);
    expect(minLng).toBeLessThan(-123.12);
    expect(maxLng).toBeGreaterThan(-123.12);
    expect(minLat).toBeLessThan(49.25);
    expect(maxLat).toBeGreaterThan(49.25);
    const latSpanKm = (maxLat - minLat) * 110.574;
    expect(latSpanKm).toBeGreaterThan(59);
    expect(latSpanKm).toBeLessThan(61);
  });
});

describe("detectCountry", () => {
  it("honours explicit country hints", () => {
    expect(detectCountry(0, 0, "Canada")).toBe("CA");
    expect(detectCountry(0, 0, "us")).toBe("US");
    expect(detectCountry(0, 0, "JP")).toBe("JP");
  });

  it("routes Vancouver to Canada (lat > 49 disambiguates from US bbox)", () => {
    expect(detectCountry(49.2497, -123.1193)).toBe("CA");
  });

  it("routes Tokyo to Japan", () => {
    expect(detectCountry(35.6762, 139.6503)).toBe("JP");
  });

  it("falls back to OTHER for unsupported regions", () => {
    expect(detectCountry(-33.865, 151.21)).toBe("OTHER"); // Sydney
    expect(detectCountry(48.8566, 2.3522)).toBe("OTHER"); // Paris
  });
});

describe("pointInGeometry / distanceKmToGeometry", () => {
  const square = {
    type: "Polygon" as const,
    coordinates: [
      [
        [-123.2, 49.2],
        [-123.0, 49.2],
        [-123.0, 49.3],
        [-123.2, 49.3],
        [-123.2, 49.2],
      ] as [number, number][],
    ],
  };

  it("detects points inside a polygon", () => {
    expect(pointInGeometry(49.25, -123.1, square)).toBe(true);
  });

  it("detects points outside a polygon", () => {
    expect(pointInGeometry(50, -124, square)).toBe(false);
  });

  it("returns zero distance when inside", () => {
    expect(distanceKmToGeometry(49.25, -123.1, square)).toBe(0);
  });

  it("returns positive distance when outside", () => {
    expect(distanceKmToGeometry(50, -124, square)).toBeGreaterThan(0);
  });
});

describe("polygonApproxRadiusKm", () => {
  it("returns the farthest-vertex distance from centroid", () => {
    const square = {
      type: "Polygon" as const,
      coordinates: [
        [
          [-123.2, 49.2],
          [-123.0, 49.2],
          [-123.0, 49.3],
          [-123.2, 49.3],
          [-123.2, 49.2],
        ] as [number, number][],
      ],
    };
    const r = polygonApproxRadiusKm(square);
    expect(r).toBeGreaterThan(5);
    expect(r).toBeLessThan(15);
  });
});
