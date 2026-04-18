import { describe, expect, it } from "vitest";
import { validateLocationSearchQuery } from "./location-search";

describe("validateLocationSearchQuery", () => {
  it("accepts multilingual city names with supported punctuation", () => {
    expect(validateLocationSearchQuery("Sao Paulo").valid).toBe(true);
    expect(validateLocationSearchQuery("Zurich").valid).toBe(true);
    expect(validateLocationSearchQuery("Москва").valid).toBe(true);
    expect(validateLocationSearchQuery("O'Fallon").valid).toBe(true);
    expect(validateLocationSearchQuery("St. John's").valid).toBe(true);
  });

  it("rejects control whitespace and unsupported punctuation", () => {
    expect(validateLocationSearchQuery("New\nYork").valid).toBe(false);
    expect(validateLocationSearchQuery("New\tYork").valid).toBe(false);
    expect(validateLocationSearchQuery("<script>").valid).toBe(false);
  });
});
