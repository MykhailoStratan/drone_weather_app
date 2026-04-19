import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TemperatureCurveChart } from "./WeatherCharts";

describe("TemperatureCurveChart", () => {
  it("shows hover tooltip content when a hover target is entered", () => {
    const view = render(
      <TemperatureCurveChart
        units="C"
        points={[
          {
            key: "2026-04-15T09:00-0",
            time: "2026-04-15T09:00",
            label: "9 AM",
            shortLabel: "9",
            isDay: true,
            value: 8,
          },
          {
            key: "2026-04-15T10:00-1",
            time: "2026-04-15T10:00",
            label: "10 AM",
            shortLabel: "10",
            isDay: true,
            value: 10,
          },
        ]}
      />,
    );

    const svg = screen.getByRole("img", { name: "Temperature curve" });
    const hoverRects = Array.from(svg.querySelectorAll("rect")).filter(
      (element) => element.getAttribute("fill") === "rgba(0, 0, 0, 0.001)",
    );
    const hoverTarget = hoverRects[hoverRects.length - 1];
    expect(hoverTarget).toBeTruthy();

    fireEvent.mouseEnter(hoverTarget as Element);

    expect(screen.getByText("10 AM")).toBeTruthy();
    expect(screen.getByText("10 C")).toBeTruthy();
    view.unmount();
  });

  it("shows tooltip content when the chart is touched", () => {
    const view = render(
      <TemperatureCurveChart
        units="C"
        points={[
          {
            key: "2026-04-15T09:00-0",
            time: "2026-04-15T09:00",
            label: "9 AM",
            shortLabel: "9",
            isDay: true,
            value: 8,
          },
          {
            key: "2026-04-15T10:00-1",
            time: "2026-04-15T10:00",
            label: "10 AM",
            shortLabel: "10",
            isDay: true,
            value: 10,
          },
        ]}
      />,
    );

    const svg = screen.getByRole("img", { name: "Temperature curve" });
    Object.defineProperty(svg, "getBoundingClientRect", {
      value: () => ({
        left: 0,
        top: 0,
        right: 420,
        bottom: 176,
        width: 420,
        height: 176,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }),
    });
    fireEvent.touchStart(svg, {
      touches: [{ clientX: 310, clientY: 80 }],
    });

    expect(screen.getByText("10 AM")).toBeTruthy();
    expect(screen.getByText("10 C")).toBeTruthy();
    view.unmount();
  });
});
