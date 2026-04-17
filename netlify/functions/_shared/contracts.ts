import type {
  DailyWeather,
  GnssEstimateResponse,
  LocationOption,
  WeatherAlertsResponse,
  WeatherOverviewResponse,
  WeatherQuery,
  WeatherTimelineResponse,
  WeatherPayload,
  WeatherSnapshot,
} from "../../../packages/weather-domain/src";

export function parseWeatherQuery(url: URL): WeatherQuery {
  const latitude = Number(url.searchParams.get("lat"));
  const longitude = Number(url.searchParams.get("lon"));

  if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
    throw new Error("Latitude and longitude are required.");
  }

  return {
    latitude,
    longitude,
    timezone: url.searchParams.get("timezone") ?? undefined,
    name: url.searchParams.get("name") ?? undefined,
    admin1: url.searchParams.get("admin1") ?? undefined,
    country: url.searchParams.get("country") ?? undefined,
  };
}

export function createGnssEstimateResponse(args: {
  location: WeatherQuery;
  timezone: string;
  latitude: number;
  longitude: number;
  estimatedVisibleSatellites: number;
  estimatedUsableSatellites: number;
  gnssScore: number;
  summary: string;
  spaceWeatherPenalty: number;
}): GnssEstimateResponse {
  return {
    locationLabel: buildLocationLabel(args.location),
    timezone: args.timezone,
    latitude: args.latitude,
    longitude: args.longitude,
    fetchedAt: new Date().toISOString(),
    estimatedVisibleSatellites: args.estimatedVisibleSatellites,
    estimatedUsableSatellites: args.estimatedUsableSatellites,
    gnssScore: args.gnssScore,
    summary: args.summary,
    spaceWeatherPenalty: args.spaceWeatherPenalty,
  };
}

export function toWeatherQuery(location: WeatherQuery): Required<Pick<LocationOption, "latitude" | "longitude">> &
  Partial<Pick<LocationOption, "name" | "admin1" | "country" | "timezone">> {
  return {
    latitude: location.latitude,
    longitude: location.longitude,
    timezone: location.timezone,
    name: location.name,
    admin1: location.admin1,
    country: location.country,
  };
}

export function buildLocationLabel(location: WeatherQuery) {
  return [location.name, location.admin1, location.country].filter(Boolean).join(", ");
}

export function createOverviewResponse(args: {
  location: WeatherQuery;
  timezone: string;
  latitude: number;
  longitude: number;
  current: WeatherSnapshot;
  today: DailyWeather;
}): WeatherOverviewResponse {
  return {
    locationLabel: buildLocationLabel(args.location),
    timezone: args.timezone,
    latitude: args.latitude,
    longitude: args.longitude,
    fetchedAt: new Date().toISOString(),
    current: args.current,
    today: args.today,
  };
}

export function createTimelineResponse(args: {
  location: WeatherQuery;
  timezone: string;
  latitude: number;
  longitude: number;
  hourly: WeatherSnapshot[];
  daily: DailyWeather[];
}): WeatherTimelineResponse {
  return {
    locationLabel: buildLocationLabel(args.location),
    timezone: args.timezone,
    latitude: args.latitude,
    longitude: args.longitude,
    fetchedAt: new Date().toISOString(),
    hourly: args.hourly,
    daily: args.daily,
  };
}

export function createAlertsResponse(args: {
  location: WeatherQuery;
  timezone: string;
  latitude: number;
  longitude: number;
  alerts: WeatherPayload["alerts"];
}): WeatherAlertsResponse {
  return {
    locationLabel: buildLocationLabel(args.location),
    timezone: args.timezone,
    latitude: args.latitude,
    longitude: args.longitude,
    fetchedAt: new Date().toISOString(),
    alerts: args.alerts,
  };
}

export function createLegacyPayload(args: {
  overview: WeatherOverviewResponse;
  timeline: WeatherTimelineResponse;
  alerts: WeatherAlertsResponse;
}): WeatherPayload {
  return {
    locationLabel: args.overview.locationLabel,
    timezone: args.overview.timezone,
    latitude: args.overview.latitude,
    longitude: args.overview.longitude,
    current: args.overview.current,
    hourly: args.timeline.hourly,
    daily: args.timeline.daily,
    alerts: args.alerts.alerts,
  };
}
