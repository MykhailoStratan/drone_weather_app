import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./faa", () => ({
  fetchFaaAirspace: vi.fn(),
  fetchFaaTfrs: vi.fn(),
}));
vi.mock("./canada", () => ({
  fetchCanadaAirspace: vi.fn(),
}));
vi.mock("./japan", () => ({
  fetchJapanAirspace: vi.fn(),
}));
vi.mock("./overpass", () => ({
  fetchOverpassAirspace: vi.fn(),
}));

import { fetchFaaAirspace, fetchFaaTfrs } from "./faa";
import { fetchCanadaAirspace } from "./canada";
import { fetchJapanAirspace } from "./japan";
import { fetchOverpassAirspace } from "./overpass";
import { fetchAirspaceBundle } from "./index";
import type { AirspaceFeature } from "../../../../packages/weather-domain/src/types";

function sampleFeature(partial: Partial<AirspaceFeature>): AirspaceFeature {
  return {
    id: "x",
    name: "n",
    featureType: "airport",
    latitude: 0,
    longitude: 0,
    classification: "controlled",
    zoneRadiusKm: 5,
    distanceKm: 1,
    bearingDeg: 0,
    source: "osm",
    ...partial,
  };
}

describe("fetchAirspaceBundle", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("routes US coordinates to FAA and includes TFRs (with country hint)", async () => {
    vi.mocked(fetchFaaAirspace).mockResolvedValue([sampleFeature({ id: "faa-1", source: "faa", icao: "KSEA" })]);
    vi.mocked(fetchFaaTfrs).mockResolvedValue([]);
    vi.mocked(fetchOverpassAirspace).mockResolvedValue([]);

    const bundle = await fetchAirspaceBundle(47.6, -122.3, "United States");
    expect(bundle.country).toBe("US");
    expect(fetchFaaAirspace).toHaveBeenCalled();
    expect(fetchFaaTfrs).toHaveBeenCalled();
    expect(bundle.features.some((f) => f.source === "faa")).toBe(true);
  });

  it("routes Canadian coordinates to Transport Canada, not FAA", async () => {
    vi.mocked(fetchCanadaAirspace).mockResolvedValue([sampleFeature({ source: "transport-canada" })]);
    vi.mocked(fetchOverpassAirspace).mockResolvedValue([]);

    const bundle = await fetchAirspaceBundle(49.25, -123.12, "Canada");
    expect(bundle.country).toBe("CA");
    expect(fetchCanadaAirspace).toHaveBeenCalled();
    expect(fetchFaaAirspace).not.toHaveBeenCalled();
    expect(bundle.tfrs).toEqual([]);
  });

  it("routes Japanese coordinates to the JP provider", async () => {
    vi.mocked(fetchJapanAirspace).mockResolvedValue([sampleFeature({ source: "japan-caa", icao: "RJTT" })]);

    const bundle = await fetchAirspaceBundle(35.68, 139.65, "Japan");
    expect(bundle.country).toBe("JP");
    expect(fetchJapanAirspace).toHaveBeenCalled();
  });

  it("falls back to Overpass for other countries", async () => {
    vi.mocked(fetchOverpassAirspace).mockResolvedValue([sampleFeature({ source: "osm" })]);

    const bundle = await fetchAirspaceBundle(-33.86, 151.21, "Australia");
    expect(bundle.country).toBe("OTHER");
    expect(fetchOverpassAirspace).toHaveBeenCalled();
  });

  it("deduplicates overlapping features by ICAO across primary and fallback", async () => {
    vi.mocked(fetchFaaAirspace).mockResolvedValue([
      sampleFeature({ id: "faa-sea", icao: "KSEA", source: "faa", name: "Seattle-Tacoma" }),
    ]);
    vi.mocked(fetchFaaTfrs).mockResolvedValue([]);
    vi.mocked(fetchOverpassAirspace).mockResolvedValue([
      sampleFeature({ id: "osm-sea", icao: "KSEA", source: "osm", name: "KSEA OSM" }),
    ]);

    const bundle = await fetchAirspaceBundle(47.45, -122.30, "USA");
    const seaCount = bundle.features.filter((f) => f.icao === "KSEA").length;
    expect(seaCount).toBe(1);
    expect(bundle.features[0].source).toBe("faa");
  });

  it("swallows provider failures and still returns a bundle", async () => {
    vi.mocked(fetchFaaAirspace).mockRejectedValue(new Error("boom"));
    vi.mocked(fetchFaaTfrs).mockRejectedValue(new Error("boom"));
    vi.mocked(fetchOverpassAirspace).mockResolvedValue([]);

    const bundle = await fetchAirspaceBundle(47.6, -122.3, "USA");
    expect(bundle.country).toBe("US");
    expect(bundle.features).toEqual([]);
    expect(bundle.tfrs).toEqual([]);
  });
});
