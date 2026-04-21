import { formatHourLabel, formatTime } from "./format";
import type { DailyWeather } from "../types";

function formatHourTick(value: string, hourCycle: "12h" | "24h") {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    hour12: hourCycle === "12h",
  }).format(new Date(value));
}

function roundToOne(n: number) {
  return Math.round(n * 10) / 10;
}

export function buildHourlySeries(
  entries: Array<{
    time: string;
    isDay: number;
    temperature: number;
    precipitationAmount: number;
    precipitationProbability: number;
    windSpeed: number;
    windDirection: number;
    pressure: number;
    cloudCover: number;
    visibility: number;
  }>,
  hourCycle: "12h" | "24h",
  visibilityFactor: number,
) {
  return {
    temperature: entries.map((entry, index) => ({
      key: `${entry.time}-${index}`,
      time: entry.time,
      label: formatHourLabel(entry.time, hourCycle),
      shortLabel: formatHourTick(entry.time, hourCycle),
      isDay: entry.isDay === 1,
      value: entry.temperature,
    })),
    precipitation: entries.map((entry, index) => ({
      key: `${entry.time}-${index}`,
      time: entry.time,
      label: formatHourLabel(entry.time, hourCycle),
      shortLabel: formatHourTick(entry.time, hourCycle),
      value: entry.precipitationAmount,
      probability: entry.precipitationProbability,
    })),
    wind: entries.map((entry, index) => ({
      key: `${entry.time}-${index}`,
      time: entry.time,
      label: formatHourLabel(entry.time, hourCycle),
      shortLabel: formatHourTick(entry.time, hourCycle),
      value: entry.windSpeed,
      direction: entry.windDirection,
    })),
    pressure: entries.map((entry, index) => ({
      key: `${entry.time}-${index}`,
      time: entry.time,
      label: formatHourLabel(entry.time, hourCycle),
      shortLabel: formatHourTick(entry.time, hourCycle),
      value: entry.pressure,
    })),
    cloudVisibility: entries.map((entry, index) => ({
      key: `${entry.time}-${index}`,
      time: entry.time,
      label: formatHourLabel(entry.time, hourCycle),
      shortLabel: formatHourTick(entry.time, hourCycle),
      value: entry.cloudCover,
      secondaryValue: roundToOne(entry.visibility * visibilityFactor),
    })),
  };
}

export type HourlyChartSeries = ReturnType<typeof buildHourlySeries>;

export function buildWeeklyRangeSeries(daily: DailyWeather[]) {
  return daily.map((day) => ({
    key: day.date,
    label: formatTime(`${day.date}T12:00`, "12h"),
    shortLabel: new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(new Date(`${day.date}T00:00:00`)),
    min: day.temperatureMin,
    max: day.temperatureMax,
  }));
}
