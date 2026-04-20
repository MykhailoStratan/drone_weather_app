import type { DailyWeather, LocationOption, WeatherAlert, WeatherSnapshot } from "./types";

export type WeatherQuery = Pick<LocationOption, "latitude" | "longitude"> &
  Partial<Pick<LocationOption, "name" | "admin1" | "country" | "timezone">>;

export type WeatherLocationMeta = {
  locationLabel: string;
  timezone: string;
  latitude: number;
  longitude: number;
};

export type WeatherOverviewResponse = WeatherLocationMeta & {
  fetchedAt: string;
  current: WeatherSnapshot;
  today: DailyWeather;
};

export type WeatherTimelineResponse = WeatherLocationMeta & {
  fetchedAt: string;
  hourly: WeatherSnapshot[];
  daily: DailyWeather[];
};

export type WeatherAlertsResponse = WeatherLocationMeta & {
  fetchedAt: string;
  alerts: WeatherAlert[];
};

export type WeatherSearchResponse = LocationOption[];

export type GnssEnvironmentPreset = "open" | "suburban" | "urban" | "trees";

export type GnssEstimateRequest = {
  location: WeatherQuery;
  environment: GnssEnvironmentPreset;
  weather: {
    cloudCover: number;
    visibilityMeters: number;
    precipitationProbability: number;
    precipitationSum: number;
    windGusts: number;
  };
};

export type GnssEstimateResponse = WeatherLocationMeta & {
  fetchedAt: string;
  dataStatus: "available" | "unavailable";
  estimatedVisibleSatellites: number | null;
  estimatedUsableSatellites: number | null;
  gnssScore: number | null;
  summary: string;
  spaceWeatherPenalty: number | null;
  unavailableReason?: string;
};
