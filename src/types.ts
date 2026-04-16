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
  precipitationProbability: number;
  cloudCover: number;
  visibility: number;
  pressure: number;
  weatherCode: number;
  isDay: number;
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

export type WeatherPayload = {
  locationLabel: string;
  timezone: string;
  latitude: number;
  longitude: number;
  current: WeatherSnapshot;
  hourly: WeatherSnapshot[];
  daily: DailyWeather[];
};
