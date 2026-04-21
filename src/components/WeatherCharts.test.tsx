import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CloudVisibilityChart, TemperatureCurveChart } from "./WeatherCharts";

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
    expect(view.container.querySelector(".chart-tooltip")?.getAttribute("style")).toContain("top:");
    view.unmount();
  });

  it("shows hover tooltip content for sky clarity", () => {
    const view = render(
      <CloudVisibilityChart
        visibilityUnits="km"
        points={[
          {
            key: "2026-04-15T09:00-0",
            time: "2026-04-15T09:00",
            label: "9 AM",
            shortLabel: "9",
            value: 22,
            secondaryValue: 10,
          },
          {
            key: "2026-04-15T10:00-1",
            time: "2026-04-15T10:00",
            label: "10 AM",
            shortLabel: "10",
            value: 68,
            secondaryValue: 4.5,
          },
        ]}
      />,
    );

    const svg = screen.getByRole("img", { name: "Cloud cover and visibility chart" });
    Object.defineProperty(svg, "getBoundingClientRect", {
      value: () => ({ left: 0, width: 420 }),
    });
    const overlay = Array.from(svg.querySelectorAll("rect")).find(
      (element) =>
        element.getAttribute("fill") === "transparent" &&
        element.getAttribute("pointer-events") === "all",
    );
    expect(overlay).toBeTruthy();

    fireEvent.mouseMove(overlay as Element, { clientX: 360 });

    expect(screen.getByText("10 AM")).toBeTruthy();
    expect(screen.getByText("68% cloud cover")).toBeTruthy();
    expect(screen.getByText("4.5 km visibility")).toBeTruthy();
    view.unmount();
  });

});
