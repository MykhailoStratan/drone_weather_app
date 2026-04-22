import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TabBar } from "./TabBar";

describe("TabBar", () => {
  afterEach(() => {
    cleanup();
  });

  it("marks the active tab with class and aria-selected", () => {
    render(<TabBar activeTab="map" onTabChange={() => {}} />);

    const nowTab = screen.getByRole("tab", { name: "Now" });
    const mapTab = screen.getByRole("tab", { name: "Map" });

    expect(mapTab.className).toContain("active");
    expect(mapTab.getAttribute("aria-selected")).toBe("true");
    expect(nowTab.className).not.toContain("active");
    expect(nowTab.getAttribute("aria-selected")).toBe("false");
  });

  it("calls onTabChange with the clicked tab", () => {
    const onTabChange = vi.fn();
    render(<TabBar activeTab="now" onTabChange={onTabChange} />);

    fireEvent.click(screen.getByRole("tab", { name: "Drone" }));

    expect(onTabChange).toHaveBeenCalledTimes(1);
    expect(onTabChange).toHaveBeenCalledWith("drone");
  });
});
