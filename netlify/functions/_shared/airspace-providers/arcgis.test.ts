import { describe, expect, it } from "vitest";
import { esriPolygonToGeoJson } from "./arcgis";

describe("esriPolygonToGeoJson", () => {
  it("returns null for empty rings", () => {
    expect(esriPolygonToGeoJson({ rings: [] })).toBeNull();
  });

  it("converts a single clockwise ring to a Polygon", () => {
    // clockwise square in screen orientation (positive shoelace sum)
    const result = esriPolygonToGeoJson({
      rings: [
        [
          [0, 0],
          [0, 1],
          [1, 1],
          [1, 0],
          [0, 0],
        ],
      ],
    });
    expect(result?.type).toBe("Polygon");
    if (result?.type === "Polygon") {
      expect(result.coordinates.length).toBe(1);
      expect(result.coordinates[0].length).toBe(5);
    }
  });

  it("groups multiple clockwise rings as a MultiPolygon", () => {
    const result = esriPolygonToGeoJson({
      rings: [
        [
          [0, 0],
          [0, 1],
          [1, 1],
          [1, 0],
          [0, 0],
        ],
        [
          [10, 10],
          [10, 11],
          [11, 11],
          [11, 10],
          [10, 10],
        ],
      ],
    });
    expect(result?.type).toBe("MultiPolygon");
    if (result?.type === "MultiPolygon") {
      expect(result.coordinates.length).toBe(2);
    }
  });

  it("attaches counter-clockwise rings as holes to the preceding shell", () => {
    const result = esriPolygonToGeoJson({
      rings: [
        // Outer (clockwise)
        [
          [0, 0],
          [0, 10],
          [10, 10],
          [10, 0],
          [0, 0],
        ],
        // Inner hole (counter-clockwise)
        [
          [3, 3],
          [6, 3],
          [6, 6],
          [3, 6],
          [3, 3],
        ],
      ],
    });
    expect(result?.type).toBe("Polygon");
    if (result?.type === "Polygon") {
      expect(result.coordinates.length).toBe(2);
    }
  });
});
