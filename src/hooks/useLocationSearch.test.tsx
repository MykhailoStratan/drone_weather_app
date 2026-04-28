import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useLocationSearch } from "./useLocationSearch";
import type { LocationOption } from "../types";

const VANCOUVER: LocationOption = {
  id: 1,
  name: "Vancouver",
  country: "Canada",
  latitude: 49.2497,
  longitude: -123.1193,
};

const VICTORIA: LocationOption = {
  id: 2,
  name: "Victoria",
  country: "Canada",
  latitude: 48.4284,
  longitude: -123.3656,
};

function createDeferredFetchResponse(payload: LocationOption[]) {
  let resolve!: () => void;
  const ready = new Promise<void>((r) => {
    resolve = r;
  });
  const responder = async (_: RequestInfo | URL, init?: RequestInit) => {
    const signal = init?.signal;
    await ready;
    if (signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }
    return new Response(JSON.stringify(payload), { status: 200 });
  };
  return { responder, resolve };
}

describe("useLocationSearch abort handling", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("aborts the previous in-flight search when a newer query starts", async () => {
    const stale = createDeferredFetchResponse([VANCOUVER]);
    const fresh = createDeferredFetchResponse([VICTORIA]);

    const calls: AbortSignal[] = [];
    let callIndex = 0;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.signal) calls.push(init.signal);
      const responder = callIndex === 0 ? stale.responder : fresh.responder;
      callIndex += 1;
      return responder(input, init);
    });
    vi.stubGlobal("fetch", fetchMock);

    const setMessage = vi.fn();
    const { result } = renderHook(() =>
      useLocationSearch({
        activeLocation: null,
        loadWeather: vi.fn(async () => {}),
        setLoading: vi.fn(),
        setMessage,
      }),
    );

    act(() => {
      result.current.setQuery("Vanc");
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 260));
    });

    act(() => {
      result.current.setQuery("Vict");
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 260));
    });

    expect(calls.length).toBe(2);
    expect(calls[0].aborted).toBe(true);
    expect(calls[1].aborted).toBe(false);

    stale.resolve();
    fresh.resolve();

    await waitFor(() => {
      expect(result.current.results).toEqual([VICTORIA]);
    });

    expect(setMessage).not.toHaveBeenCalledWith(expect.stringMatching(/unable to search/i));
  });

  it("ignores AbortError without surfacing an error message", async () => {
    const fetchMock = vi.fn(async (_: RequestInfo | URL, init?: RequestInit) => {
      const signal = init?.signal;
      return new Promise<Response>((_resolve, reject) => {
        signal?.addEventListener("abort", () => {
          reject(new DOMException("Aborted", "AbortError"));
        });
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const setMessage = vi.fn();
    const { result, unmount } = renderHook(() =>
      useLocationSearch({
        activeLocation: null,
        loadWeather: vi.fn(async () => {}),
        setLoading: vi.fn(),
        setMessage,
      }),
    );

    act(() => {
      result.current.setQuery("Tokyo");
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 260));
    });

    unmount();

    await new Promise((r) => setTimeout(r, 20));
    expect(setMessage).not.toHaveBeenCalledWith(expect.stringMatching(/unable to search/i));
  });
});
