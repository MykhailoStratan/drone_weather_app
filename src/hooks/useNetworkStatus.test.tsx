import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useNetworkStatus } from "./useNetworkStatus";

function setOnLine(value: boolean) {
  Object.defineProperty(window.navigator, "onLine", {
    configurable: true,
    value,
  });
}

describe("useNetworkStatus", () => {
  afterEach(() => {
    cleanup();
    setOnLine(true);
  });

  it("reads navigator.onLine on mount", () => {
    setOnLine(false);
    const { result } = renderHook(() => useNetworkStatus());
    expect(result.current.online).toBe(false);
  });

  it("flips to offline when the offline event fires", () => {
    setOnLine(true);
    const { result } = renderHook(() => useNetworkStatus());
    expect(result.current.online).toBe(true);

    act(() => {
      setOnLine(false);
      window.dispatchEvent(new Event("offline"));
    });
    expect(result.current.online).toBe(false);
  });

  it("recovers to online when the online event fires", () => {
    setOnLine(false);
    const { result } = renderHook(() => useNetworkStatus());
    expect(result.current.online).toBe(false);

    act(() => {
      setOnLine(true);
      window.dispatchEvent(new Event("online"));
    });
    expect(result.current.online).toBe(true);
  });

  it("removes listeners on unmount", () => {
    setOnLine(true);
    const { result, unmount } = renderHook(() => useNetworkStatus());
    unmount();

    act(() => {
      setOnLine(false);
      window.dispatchEvent(new Event("offline"));
    });
    expect(result.current.online).toBe(true);
  });
});
