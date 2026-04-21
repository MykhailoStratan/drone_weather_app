export type LocationOption = {
  id: number;
  name: string;
  country: string;
  admin1?: string;
  latitude: number;
  longitude: number;
  timezone?: string;
};

export type WeatherSnapshot = {
  time: string;
  temperature: number;
  windSpeed: number;
  windGusts: number;
  windDirection: number;
  precipitationAmount: number;
  precipitationProbability: number;
  cloudCover: number;
  visibility: number;
  pressure: number;
  weatherCode: number;
  isDay: number;
  windSpeed80m?: number;
  windGusts80m?: number;
  windDirection80m?: number;
  windSpeed120m?: number;
  windGusts120m?: number;
  windDirection120m?: number;
  relativeHumidity?: number;
};

export type DailyWeather = {
  date: string;
  sunrise: string;
  sunset: string;
  temperatureMax: number;
  temperatureMin: number;
  windSpeedMax: number;
  windGustsMax: number;
  precipitationProbabilityMax: number;
  precipitationHours: number;
  precipitationSum: number;
  weatherCode: number;
};

export type AirspaceClass = "controlled" | "advisory" | "restricted" | "danger" | "military";

export type AirspaceFeatureType =
  | "airport"
  | "helipad"
  | "aerodrome"
  | "military"
  | "restricted"
  | "danger"
  | "class_b"
  | "class_c"
  | "class_d"
  | "class_e"
  | "ctr"
  | "cya"
  | "cyr"
  | "cyd"
  | "moa"
  | "warning"
  | "alert"
  | "prohibited";

export type AirspaceGeometry =
  | { type: "Point"; coordinates: [number, number] }
  | { type: "Polygon"; coordinates: [number, number][][] }
  | { type: "MultiPolygon"; coordinates: [number, number][][][] };

export type AirspaceSource = "faa" | "transport-canada" | "japan-caa" | "openaip" | "osm";

export type AirspaceFeature = {
  id: string;
  name: string;
  featureType: AirspaceFeatureType;
  latitude: number;
  longitude: number;
  geometry?: AirspaceGeometry;
  icao?: string;
  classification: AirspaceClass;
  zoneRadiusKm: number;
  distanceKm: number;
  bearingDeg: number;
  altitudeLowerFt?: number;
  altitudeUpperFt?: number;
  source: AirspaceSource;
};

export type TFRFeature = {
  id: string;
  notamNumber: string;
  latitude: number;
  longitude: number;
  radiusNm: number;
  altitudeLowerFt: number;
  altitudeUpperFt: number;
  effectiveStart?: string;
  effectiveEnd?: string;
  distanceKm: number;
};

export type AirspaceCountry = "US" | "CA" | "JP" | "OTHER";

export type AirspaceResponse = {
  latitude: number;
  longitude: number;
  fetchedAt: string;
  country: AirspaceCountry;
  dataSources: string[];
  features: AirspaceFeature[];
  tfrs: TFRFeature[];
};

export type WeatherAlert = {
  id: string;
  event: string;
  headline: string;
  severity: string;
  urgency: string;
  area: string;
  startsAt?: string;
  endsAt?: string;
};

export type WeatherPayload = {
  locationLabel: string;
  timezone: string;
  latitude: number;
  longitude: number;
  current: WeatherSnapshot;
  hourly: WeatherSnapshot[];
  daily: DailyWeather[];
  alerts: WeatherAlert[];
};
