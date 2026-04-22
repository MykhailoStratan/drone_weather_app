import { useEffect, useState } from "react";
import { fetchAirspace } from "../lib/weather";
import type { AirspaceResponse, LocationOption } from "../types";

export function useAirspace(activeLocation: LocationOption | null) {
  const [airspace, setAirspace] = useState<AirspaceResponse | null>(null);
  const [airspaceLoading, setAirspaceLoading] = useState(false);
  const [airspaceError, setAirspaceError] = useState<string | null>(null);

  useEffect(() => {
    if (!activeLocation) {
      setAirspace(null);
      setAirspaceLoading(false);
      setAirspaceError(null);
      return;
    }

    let cancelled = false;
    setAirspace(null);
    setAirspaceLoading(true);
    setAirspaceError(null);

    void fetchAirspace(activeLocation)
      .then((response) => {
        if (!cancelled) {
          setAirspace(response);
          setAirspaceError(null);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setAirspace(null);
          setAirspaceError(error instanceof Error ? error.message : "Airspace data is unavailable right now.");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setAirspaceLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeLocation]);

  return { airspace, airspaceError, airspaceLoading };
}
