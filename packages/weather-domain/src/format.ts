export function formatDayLabel(date: string) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(`${date}T00:00:00`));
}

export function formatHourLabel(value: string, hourCycle: "12h" | "24h" = "12h") {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    hour12: hourCycle === "12h",
  }).format(new Date(value));
}

export function formatTime(value: string, hourCycle: "12h" | "24h" = "12h") {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    hour12: hourCycle === "12h",
  }).format(new Date(value));
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
