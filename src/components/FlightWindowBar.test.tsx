import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getHourScrubberVisibleSnapshots, HourScrubber } from "./FlightWindowBar";
import type { WeatherSnapshot } from "../types";

function makeSnapshot(time: string): WeatherSnapshot {
  return {
    time,
    temperature: 10,
    windSpeed: 8,
    windGusts: 10,
    windDirection: 90,
    precipitationAmount: 0,
    precipitationProbability: 0,
    cloudCover: 20,
    visibility: 10000,
    pressure: 1012,
    weatherCode: 0,
    isDay: 1,
  };
}

describe("HourScrubber", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("keeps the center tick anchored on the real current time when tomorrow is selected", () => {
    vi.spyOn(Date, "now").mockReturnValue(new Date("2026-04-15T12:00:00").getTime());

    const prevDayHourly = Array.from({ length: 24 }, (_, index) =>
      makeSnapshot(`2026-04-15T${String(index).padStart(2, "0")}:00`),
    );
    const hourlyForDay = Array.from({ length: 24 }, (_, index) =>
      makeSnapshot(`2026-04-16T${String(index).padStart(2, "0")}:00`),
    );

    const view = render(
      <HourScrubber
        hourlyForDay={hourlyForDay}
        prevDayHourly={prevDayHourly}
        hourCycle="12h"
        activeHourIndex={0}
        onHourChange={() => {}}
      />,
    );

    expect(view.container.querySelector(".hour-scrubber-tick-now")?.textContent).toBe("12:00 PM");
    expect(view.container.querySelectorAll(".hour-scrubber-seg.prev-day").length).toBeGreaterThan(0);
    expect(view.container.querySelectorAll(".hour-scrubber-seg.next-day").length).toBe(0);
  });

  it("returns the same 24-hour visible snapshot window used by the timeline", () => {
    vi.spyOn(Date, "now").mockReturnValue(new Date("2026-04-15T12:00:00").getTime());

    const prevDayHourly = Array.from({ length: 24 }, (_, index) =>
      makeSnapshot(`2026-04-14T${String(index).padStart(2, "0")}:00`),
    );
    const hourlyForDay = Array.from({ length: 24 }, (_, index) =>
      makeSnapshot(`2026-04-15T${String(index).padStart(2, "0")}:00`),
    );
    const nextDayHourly = Array.from({ length: 24 }, (_, index) =>
      makeSnapshot(`2026-04-16T${String(index).padStart(2, "0")}:00`),
    );

    const visibleSnapshots = getHourScrubberVisibleSnapshots({
      hourlyForDay,
      nextDayHourly,
      prevDayHourly,
    });

    expect(visibleSnapshots).toHaveLength(24);
    expect(visibleSnapshots[0].time).toBe("2026-04-15T01:00");
    expect(visibleSnapshots[11].time).toBe("2026-04-15T12:00");
    expect(visibleSnapshots[23].time).toBe("2026-04-16T00:00");
  });
});
