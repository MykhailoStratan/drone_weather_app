import type { LocationOption, WeatherPayload } from "../../../packages/weather-domain/src/types";
import {
  createAlertsResponse,
  createLegacyPayload,
  createOverviewResponse,
  createTimelineResponse,
  toWeatherQuery,
} from "./contracts";
import {
  fetchForecastBundle,
  fetchUnitedStatesAlerts,
  searchLocationsFromProvider,
} from "./provider";

export { searchLocationsFromProvider } from "./provider";

export async function fetchWeatherFromProvider(location: LocationOption): Promise<WeatherPayload> {
  const query = toWeatherQuery(location);
  const forecast = await fetchForecastBundle(query);
  const alerts = await fetchUnitedStatesAlerts(query);
  const today = forecast.daily[7] ?? forecast.daily[0];

  const overview = createOverviewResponse({
    location: query,
    timezone: forecast.timezone,
    latitude: forecast.latitude,
    longitude: forecast.longitude,
    current: forecast.current,
    today,
  });

  const timeline = createTimelineResponse({
    location: query,
    timezone: forecast.timezone,
    latitude: forecast.latitude,
    longitude: forecast.longitude,
    hourly: forecast.hourly,
    daily: forecast.daily,
  });

  const alertsResponse = createAlertsResponse({
    location: query,
    timezone: forecast.timezone,
    latitude: forecast.latitude,
    longitude: forecast.longitude,
    alerts,
  });

  return createLegacyPayload({
    overview,
    timeline,
    alerts: alertsResponse,
  });
}
