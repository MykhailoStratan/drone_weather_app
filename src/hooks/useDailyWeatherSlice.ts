import { useMemo } from "react";
import type { WeatherPayload } from "../types";

function shiftDate(date: string, dayOffset: number) {
  // Use UTC arithmetic so the result never shifts by a calendar day due to browser timezone offset.
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + dayOffset)).toISOString().slice(0, 10);
}

export function useDailyWeatherSlice(weather: WeatherPayload | null, selectedDate: string) {
  const currentDay = useMemo(
    () => weather?.daily.find((day) => day.date === selectedDate) ?? weather?.daily[0],
    [weather?.daily, selectedDate],
  );

  const hourlyForDay = useMemo(
    () => weather?.hourly.filter((entry) => entry.time.startsWith(selectedDate)) ?? [],
    [weather?.hourly, selectedDate],
  );

  const nextDayHourly = useMemo(() => {
    if (!selectedDate || !weather) return [];
    return weather.hourly.filter((entry) => entry.time.startsWith(shiftDate(selectedDate, 1)));
  }, [selectedDate, weather]);

  const prevDayHourly = useMemo(() => {
    if (!selectedDate || !weather) return [];
    return weather.hourly.filter((entry) => entry.time.startsWith(shiftDate(selectedDate, -1)));
  }, [selectedDate, weather]);

  return { currentDay, hourlyForDay, nextDayHourly, prevDayHourly };
}
