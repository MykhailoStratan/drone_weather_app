import { formatHourLabel, formatTime } from "./format";
import type { DailyWeather } from "../types";

function formatHourTick(value: string, hourCycle: "12h" | "24h") {
  const naive = !value.endsWith("Z") && !/[+-]\d{2}:\d{2}$/.test(value);
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    hour12: hourCycle === "12h",
    timeZone: naive ? "UTC" : undefined,
  }).format(naive ? new Date(`${value}Z`) : new Date(value));
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
    shortLabel: new Intl.DateTimeFormat(undefined, { weekday: "short", timeZone: "UTC" }).format(new Date(`${day.date}T12:00:00Z`)),
    min: day.temperatureMin,
    max: day.temperatureMax,
  }));
}
