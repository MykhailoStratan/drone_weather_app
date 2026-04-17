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
  const [overviewBundle, timelineBundle, alerts] = await Promise.all([
    fetchOverviewBundle(query),
    fetchTimelineBundle(query),
    fetchUnitedStatesAlerts(query),
  ]);

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
