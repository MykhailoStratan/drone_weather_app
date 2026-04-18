import type { WeatherPayload, WeatherSnapshot } from "../types";
import {
  IconCloud,
  IconCloudDrizzle,
  IconMoon,
  IconPartlyCloudy,
  IconRain,
  IconSnow,
  IconStorm,
  IconSun,
} from "../components/Icons";

export function resolveSelectedSnapshot(
  hourlyForDay: WeatherSnapshot[],
  selectedHourIndex: number,
  current: WeatherPayload["current"] | undefined,
) {
  if (!hourlyForDay.length) {
    return { snapshot: current, index: 0 };
  }

  const index =
    selectedHourIndex >= 0 && selectedHourIndex < hourlyForDay.length
      ? selectedHourIndex
      : findNearestSnapshotIndex(hourlyForDay);

  return { snapshot: hourlyForDay[index], index };
}

export function findNearestSnapshotIndex(hourlyForDay: WeatherSnapshot[]) {
  if (!hourlyForDay.length) return 0;

  const now = Date.now();
  return hourlyForDay.reduce((closestIndex, entry, index) => {
    const distance = Math.abs(new Date(entry.time).getTime() - now);
    const closestDistance = Math.abs(new Date(hourlyForDay[closestIndex].time).getTime() - now);
    return distance < closestDistance ? index : closestIndex;
  }, 0);
}

export function weatherGlyph(weatherCode: number, isDay: boolean) {
  if (weatherCode === 0) return isDay ? <IconSun /> : <IconMoon />;
  if ([1, 2].includes(weatherCode)) return <IconPartlyCloudy />;
  if ([3, 45, 48].includes(weatherCode)) return <IconCloud />;
  if ([51, 53, 55, 56, 57].includes(weatherCode)) return <IconCloudDrizzle />;
  if ([61, 63, 65, 80, 81, 82].includes(weatherCode)) return <IconRain />;
  if ([66, 67, 71, 73, 75, 77, 85, 86].includes(weatherCode)) return <IconSnow />;
  if ([95, 96, 99].includes(weatherCode)) return <IconStorm />;
  return <IconCloud />;
}

export function formatSavedAtLabel(savedAt: string) {
  const deltaMinutes = Math.max(0, Math.round((Date.now() - new Date(savedAt).getTime()) / 60000));
  if (deltaMinutes < 1) return "JUST NOW";
  if (deltaMinutes < 60) return `${deltaMinutes}M AGO`;
  const deltaHours = Math.round(deltaMinutes / 60);
  if (deltaHours < 24) return `${deltaHours}H AGO`;
  const deltaDays = Math.round(deltaHours / 24);
  return `${deltaDays}D AGO`;
}
