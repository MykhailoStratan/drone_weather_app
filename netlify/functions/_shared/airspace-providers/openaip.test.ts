import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchOpenAipAirspace } from "./openaip";

describe("fetchOpenAipAirspace", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("requests OpenAIP using documented lat,lng position order and maps polygons", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [
          {
            _id: "airspace-1",
            name: "Vancouver CTR",
            icaoClass: 3,
            type: 4,
            geometry: {
              type: "Polygon",
              coordinates: [
                [
                  [-123.3, 49.1],
                  [-123.0, 49.1],
                  [-123.0, 49.4],
                  [-123.3, 49.4],
                  [-123.3, 49.1],
                ],
              ],
            },
            lowerLimit: { value: 0, unit: 0 },
            upperLimit: { value: 25, unit: 1 },
          },
        ],
      }),
    } as Response);

    const features = await fetchOpenAipAirspace(49.2497, -123.1193, "client-id");
    const requested = new URL(String(fetchMock.mock.calls[0][0]));

    expect(requested.searchParams.get("pos")).toBe("49.2497,-123.1193");
    expect(fetchMock.mock.calls[0][1]?.headers).toMatchObject({
      "x-openaip-client-id": "client-id",
    });
    expect(features[0]).toMatchObject({
      id: "airspace-1",
      name: "Vancouver CTR",
      featureType: "ctr",
      classification: "controlled",
      altitudeUpperFt: 2500,
      source: "openaip",
    });
    expect(features[0].geometry?.type).toBe("Polygon");
  });
});
