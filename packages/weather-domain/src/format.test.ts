import { describe, expect, it } from "vitest";
import {
  formatHourLabel,
  temperatureDisplay,
  visibilityDisplay,
  windSpeedDisplay,
} from "./format";

describe("weather-domain format helpers", () => {
  it("converts temperature between celsius and fahrenheit", () => {
    expect(temperatureDisplay(4, "c")).toBe(4);
    expect(temperatureDisplay(4, "f")).toBe(39);
  });

  it("converts wind and visibility units", () => {
    expect(windSpeedDisplay(10, "kmh")).toBe(10);
    expect(windSpeedDisplay(10, "mph")).toBe(6);
    expect(visibilityDisplay(10, "km")).toBe("10.0");
    expect(visibilityDisplay(10, "mi")).toBe("6.2");
  });

  it("formats hour labels according to hour cycle", () => {
    const value = "2026-04-15T17:00";
    expect(formatHourLabel(value, "24h")).toContain("17");
    expect(formatHourLabel(value, "12h")).not.toBe(formatHourLabel(value, "24h"));
  });
});
