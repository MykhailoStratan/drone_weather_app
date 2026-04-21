import { useEffect, useState } from "react";
import { fetchAirspace } from "../lib/weather";
import type { AirspaceResponse, LocationOption } from "../types";

export function useAirspace(activeLocation: LocationOption | null) {
  const [airspace, setAirspace] = useState<AirspaceResponse | null>(null);
  const [airspaceLoading, setAirspaceLoading] = useState(false);

  useEffect(() => {
    if (!activeLocation) {
      setAirspace(null);
      setAirspaceLoading(false);
      return;
    }

    let cancelled = false;
    setAirspace(null);
    setAirspaceLoading(true);

    void fetchAirspace(activeLocation)
      .then((response) => {
        if (!cancelled) {
          setAirspace(response);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAirspace(null);
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

  return { airspace, airspaceLoading };
}
