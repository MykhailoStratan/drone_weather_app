import { useMemo } from "react";
import type { WeatherPayload } from "../types";

function shiftDate(date: string, dayOffset: number) {
  const shifted = new Date(`${date}T00:00:00`);
  shifted.setDate(shifted.getDate() + dayOffset);
  return shifted.toISOString().slice(0, 10);
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
