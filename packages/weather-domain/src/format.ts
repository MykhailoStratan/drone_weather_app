// Open-Meteo returns naive local-time strings with no UTC offset (e.g. "2026-04-27T14:30:00").
// Appending "Z" and formatting as UTC displays the exact hours/minutes the API sent,
// regardless of the browser's timezone.
function isNaive(value: string): boolean {
  return !value.endsWith("Z") && !/[+-]\d{2}:\d{2}$/.test(value);
}

export function formatDayLabel(date: string) {
  // Use noon UTC so the date never shifts across a day boundary for any timezone.
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));
}

export function formatHourLabel(value: string, hourCycle: "12h" | "24h" = "12h") {
  const naive = isNaive(value);
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    hour12: hourCycle === "12h",
    timeZone: naive ? "UTC" : undefined,
  }).format(naive ? new Date(`${value}Z`) : new Date(value));
}

export function formatTime(value: string, hourCycle: "12h" | "24h" = "12h") {
  const naive = isNaive(value);
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    hour12: hourCycle === "12h",
    timeZone: naive ? "UTC" : undefined,
  }).format(naive ? new Date(`${value}Z`) : new Date(value));
}

export function temperatureDisplay(valueCelsius: number, unit: "c" | "f") {
  return unit === "f" ? Math.round((valueCelsius * 9) / 5 + 32) : Math.round(valueCelsius);
}

export function windSpeedDisplay(valueKmh: number, unit: "kmh" | "mph") {
  return unit === "mph" ? Math.round(valueKmh * 0.621371) : Math.round(valueKmh);
}

export function visibilityDisplay(valueKm: number, unit: "km" | "mi") {
  return unit === "mi" ? (valueKm * 0.621371).toFixed(1) : valueKm.toFixed(1);
}

export function windDirectionLabel(degrees: number) {
  const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const index = Math.round(degrees / 45) % 8;
  return directions[index];
}

export function weatherLabel(code: number) {
  const map: Record<number, string> = {
    0: "Clear sky",
    1: "Mainly clear",
    2: "Partly cloudy",
    3: "Overcast",
    45: "Fog",
    48: "Rime fog",
    51: "Light drizzle",
    53: "Drizzle",
    55: "Heavy drizzle",
    61: "Light rain",
    63: "Rain",
    65: "Heavy rain",
    71: "Light snow",
    73: "Snow",
    75: "Heavy snow",
    77: "Snow grains",
    80: "Rain showers",
    81: "Heavy showers",
    82: "Violent showers",
    85: "Snow showers",
    86: "Heavy snow showers",
    95: "Thunderstorm",
    96: "Thunderstorm and hail",
    99: "Severe thunderstorm",
  };

  return map[code] ?? "Mixed conditions";
}
