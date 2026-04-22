import { useRef, useState } from "react";
import { buildWeatherFromOverview, readStoredOverview, storeLocation, storeOverview } from "../lib/storage";
import { fetchWeatherAlerts, fetchWeatherOverview, fetchWeatherTimeline } from "../lib/weather";
import type { LocationOption, WeatherOverviewResponse, WeatherPayload } from "../types";

export type DataStatus = {
  savedAt: string;
  source: "cached" | "live";
};

export type DetailLoadState = "idle" | "loading" | "ready" | "error";

export type WeatherDetailStatus = {
  timeline: DetailLoadState;
  alerts: DetailLoadState;
  timelineMessage?: string;
  alertsMessage?: string;
};

type UseWeatherDataArgs = {
  lastLocationKey: string;
  onOverviewLoaded?: (overview: WeatherOverviewResponse, location: LocationOption) => void;
};

const idleDetailStatus: WeatherDetailStatus = {
  timeline: "idle",
  alerts: "idle",
};

const loadingDetailStatus: WeatherDetailStatus = {
  timeline: "loading",
  alerts: "loading",
};

function messageFromRejection(result: PromiseRejectedResult, fallback: string) {
  return result.reason instanceof Error ? result.reason.message : fallback;
}

export function useWeatherData({
  lastLocationKey,
  onOverviewLoaded,
}: UseWeatherDataArgs) {
  const [weather, setWeather] = useState<WeatherPayload | null>(null);
  const [activeLocation, setActiveLocation] = useState<LocationOption | null>(null);
  const [selectedDate, setSelectedDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsStatus, setDetailsStatus] = useState<WeatherDetailStatus>(idleDetailStatus);
  const [message, setMessage] = useState("");
  const [loadError, setLoadError] = useState<{ message: string; location: LocationOption } | null>(null);
  const [dataStatus, setDataStatus] = useState<DataStatus | null>(null);
  const [requestedLocation, setRequestedLocation] = useState<LocationOption | null>(null);
  const requestId = useRef(0);

  function hydrateFromCachedOverview(cachedOverview: {
    savedAt: string;
    location: LocationOption;
    overview: WeatherOverviewResponse;
  }) {
    setWeather(buildWeatherFromOverview(cachedOverview.overview));
    setSelectedDate(cachedOverview.overview.today.date);
    setActiveLocation(cachedOverview.location);
    setDataStatus({ savedAt: cachedOverview.savedAt, source: "cached" });
    setDetailsStatus(idleDetailStatus);
    setLoading(false);
  }

  async function loadWeather(location: LocationOption) {
    const nextRequestId = requestId.current + 1;
    requestId.current = nextRequestId;
    setRequestedLocation(location);
    setLoading(true);
    setDetailsLoading(true);
    setDetailsStatus(loadingDetailStatus);
    setMessage("");
    setLoadError(null);

    try {
      const overview = await fetchWeatherOverview(location);
      if (requestId.current !== nextRequestId) {
        return;
      }

      const initialPayload: WeatherPayload = {
        locationLabel: overview.locationLabel,
        timezone: overview.timezone,
        latitude: overview.latitude,
        longitude: overview.longitude,
        current: overview.current,
        hourly: [],
        daily: [overview.today],
        alerts: [],
      };

      setWeather(initialPayload);
      setSelectedDate(overview.today.date);
      setActiveLocation(location);
      storeOverview(location, overview);
      setDataStatus({ savedAt: new Date().toISOString(), source: "live" });
      storeLocation(lastLocationKey, location);
      setLoadError(null);
      setLoading(false);
      onOverviewLoaded?.(overview, location);

      void Promise.allSettled([fetchWeatherTimeline(location), fetchWeatherAlerts(location)]).then((results) => {
        if (requestId.current !== nextRequestId) {
          return;
        }

        const [timelineResult, alertsResult] = results;

        setWeather((currentWeather) => {
          if (!currentWeather) {
            return currentWeather;
          }

          return {
            ...currentWeather,
            hourly: timelineResult.status === "fulfilled" ? timelineResult.value.hourly : currentWeather.hourly,
            daily: timelineResult.status === "fulfilled" ? timelineResult.value.daily : currentWeather.daily,
            alerts: alertsResult.status === "fulfilled" ? alertsResult.value.alerts : currentWeather.alerts,
          };
        });

        if (timelineResult.status === "rejected") {
          setDetailsStatus({
            timeline: "error",
            alerts: alertsResult.status === "fulfilled" ? "ready" : "error",
            timelineMessage: messageFromRejection(timelineResult, "Weather timeline is unavailable right now."),
            alertsMessage:
              alertsResult.status === "rejected"
                ? messageFromRejection(alertsResult, "Weather alerts are unavailable right now.")
                : undefined,
          });
        } else {
          setDetailsStatus({
            timeline: "ready",
            alerts: alertsResult.status === "fulfilled" ? "ready" : "error",
            alertsMessage:
              alertsResult.status === "rejected"
                ? messageFromRejection(alertsResult, "Weather alerts are unavailable right now.")
                : undefined,
          });
        }

        setDetailsLoading(false);
      });
    } catch (error) {
      if (requestId.current !== nextRequestId) return;

      const cachedFallback = readStoredOverview();
      if (cachedFallback) {
        hydrateFromCachedOverview(cachedFallback);
        setLoadError(null);
      } else {
        const nextMessage = error instanceof Error ? error.message : "Unable to load weather.";
        setLoadError({ message: nextMessage, location });
      }
      setLoading(false);
      setDetailsLoading(false);
      setDetailsStatus(idleDetailStatus);
    }
  }

  function retryRequestedLocation() {
    if (requestedLocation) {
      void loadWeather(requestedLocation);
    } else if (loadError?.location) {
      void loadWeather(loadError.location);
    }
  }

  return {
    activeLocation,
    dataStatus,
    detailsLoading,
    detailsStatus,
    loadError,
    loading,
    message,
    requestedLocation,
    selectedDate,
    setActiveLocation,
    setDetailsLoading,
    setLoading,
    setMessage,
    setSelectedDate,
    weather,
    hydrateFromCachedOverview,
    loadWeather,
    retryRequestedLocation,
  };
}
