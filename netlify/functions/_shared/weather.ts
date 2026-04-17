import type { LocationOption, WeatherPayload } from "../../../packages/weather-domain/src/types";
import {
  createAlertsResponse,
  createLegacyPayload,
  createOverviewResponse,
  createTimelineResponse,
  toWeatherQuery,
} from "./contracts";
import {
  fetchOverviewBundle,
  fetchTimelineBundle,
  fetchUnitedStatesAlerts,
  searchLocationsFromProvider,
} from "./provider";

export { searchLocationsFromProvider } from "./provider";

export async function fetchWeatherFromProvider(location: LocationOption): Promise<WeatherPayload> {
  const query = toWeatherQuery(location);
  const [overviewResult, timelineResult, alertsResult] = await Promise.allSettled([
    fetchOverviewBundle(query),
    fetchTimelineBundle(query),
    fetchUnitedStatesAlerts(query),
  ]);

  if (overviewResult.status === "rejected") {
    throw overviewResult.reason;
  }

  const overviewBundle = overviewResult.value;
  const timelineBundle =
    timelineResult.status === "fulfilled"
      ? timelineResult.value
      : {
          timezone: overviewBundle.timezone,
          latitude: overviewBundle.latitude,
          longitude: overviewBundle.longitude,
          hourly: [],
          daily: [overviewBundle.today],
        };
  const alerts = alertsResult.status === "fulfilled" ? alertsResult.value : [];

  if (timelineResult.status === "rejected") {
    console.warn("[weather-provider] legacy timeline degraded", timelineResult.reason);
  }
  if (alertsResult.status === "rejected") {
    console.warn("[weather-provider] legacy alerts degraded", alertsResult.reason);
  }

  const overview = createOverviewResponse({
    location: query,
    timezone: overviewBundle.timezone,
    latitude: overviewBundle.latitude,
    longitude: overviewBundle.longitude,
    current: overviewBundle.current,
    today: overviewBundle.today,
  });

  const timeline = createTimelineResponse({
    location: query,
    timezone: timelineBundle.timezone,
    latitude: timelineBundle.latitude,
    longitude: timelineBundle.longitude,
    hourly: timelineBundle.hourly,
    daily: timelineBundle.daily,
  });

  const alertsResponse = createAlertsResponse({
    location: query,
    timezone: overviewBundle.timezone,
    latitude: overviewBundle.latitude,
    longitude: overviewBundle.longitude,
    alerts,
  });

  return createLegacyPayload({
    overview,
    timeline,
    alerts: alertsResponse,
  });
}
