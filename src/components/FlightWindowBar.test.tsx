import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getHourRiskDetails, getHourScrubberVisibleSnapshots, HourScrubber } from "./FlightWindowBar";
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

  it("shows the whole selected day when current-time centering is disabled", () => {
    vi.spyOn(Date, "now").mockReturnValue(new Date("2026-04-15T12:00:00").getTime());

    const hourlyForDay = Array.from({ length: 24 }, (_, index) =>
      makeSnapshot(`2026-04-16T${String(index).padStart(2, "0")}:00`),
    );

    const visibleSnapshots = getHourScrubberVisibleSnapshots({
      hourlyForDay,
      centerOnCurrentTime: false,
    });

    expect(visibleSnapshots).toHaveLength(24);
    expect(visibleSnapshots[0].time).toBe("2026-04-16T00:00");
    expect(visibleSnapshots[11].time).toBe("2026-04-16T11:00");
    expect(visibleSnapshots[23].time).toBe("2026-04-16T23:00");

    const view = render(
      <HourScrubber
        hourlyForDay={hourlyForDay}
        hourCycle="12h"
        activeHourIndex={11}
        centerOnCurrentTime={false}
        onHourChange={() => {}}
      />,
    );

    expect(view.container.querySelector(".hour-scrubber-tick-now")?.textContent).toBe("11:00 AM");
    expect(view.container.querySelectorAll(".hour-scrubber-seg.now").length).toBe(0);
  });

  it("explains every condition that turns an hour orange or red", () => {
    const details = getHourRiskDetails({
      ...makeSnapshot("2026-04-15T12:00"),
      windGusts: 32,
      precipitationProbability: 35,
      visibility: 2500,
      cloudCover: 94,
    });

    expect(details.tone).toBe("risk");
    expect(details.riskReasons).toEqual([
      {
        metric: "Wind gusts",
        value: "32 km/h",
        threshold: "Caution at 28 km/h or higher",
        tone: "risk",
      },
      {
        metric: "Rain probability",
        value: "35%",
        threshold: "Moderate at 30% or higher",
        tone: "caution",
      },
      {
        metric: "Visibility",
        value: "2.5 km",
        threshold: "Caution below 3.0 km",
        tone: "risk",
      },
      {
        metric: "Cloud cover",
        value: "94%",
        threshold: "Moderate at 90% or higher",
        tone: "caution",
      },
    ]);
  });
});
