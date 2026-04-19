import type { WeatherSnapshot } from "../types";
import { formatHourLabel } from "../lib/format";

type WindowTone = "good" | "caution" | "risk";

type HourWindow = {
  time: string;
  tone: WindowTone;
  reasons: string[];
};

function classifyHour(snap: WeatherSnapshot): HourWindow {
  const reasons: string[] = [];
  let worst: WindowTone = "good";

  const gustsKmh = snap.windGusts;
  if (gustsKmh >= 28) { worst = "risk"; reasons.push(`gusts ${Math.round(gustsKmh)} km/h`); }
  else if (gustsKmh >= 18) { if (worst !== "risk") worst = "caution"; reasons.push(`gusts ${Math.round(gustsKmh)} km/h`); }

  const rainPct = snap.precipitationProbability;
  if (rainPct >= 60) { worst = "risk"; reasons.push(`rain ${Math.round(rainPct)}%`); }
  else if (rainPct >= 30) { if (worst !== "risk") worst = "caution"; reasons.push(`rain ${Math.round(rainPct)}%`); }

  const visKm = snap.visibility / 1000;
  if (visKm < 3) { worst = "risk"; reasons.push(`vis ${visKm.toFixed(1)} km`); }
  else if (visKm < 6) { if (worst !== "risk") worst = "caution"; reasons.push(`vis ${visKm.toFixed(1)} km`); }

  const cloud = snap.cloudCover;
  if (cloud >= 90) { if (worst !== "risk") worst = "caution"; }

  return { time: snap.time, tone: worst, reasons };
}

export function FlightWindowBar({
  hourlyToday,
  hourCycle,
}: {
  hourlyToday: WeatherSnapshot[];
  hourCycle: "12h" | "24h";
}) {
  if (hourlyToday.length === 0) return null;

  const windows: HourWindow[] = hourlyToday.map(classifyHour);
  const nowMs = Date.now();
  const nowIndex = hourlyToday.reduce((closest, snap, i) => {
    return Math.abs(new Date(snap.time).getTime() - nowMs) <
      Math.abs(new Date(hourlyToday[closest].time).getTime() - nowMs)
      ? i
      : closest;
  }, 0);

  const goodCount = windows.filter((w) => w.tone === "good").length;
  const summary =
    goodCount === windows.length
      ? "All clear today"
      : goodCount === 0
      ? "No safe windows today"
      : `${goodCount} of ${windows.length}h flyable`;

  const tickIndices = [0, Math.floor(windows.length / 2), windows.length - 1];

  return (
    <div className="flight-window-card">
      <div className="flight-window-header">
        <p className="section-label">Flight window · today</p>
        <span className="flight-window-summary">{summary}</span>
      </div>
      <div className="flight-window-bar" aria-label="Hourly flight conditions for today">
        {windows.map((w, i) => (
          <div
            key={w.time}
            className={`flight-window-seg ${w.tone}${i === nowIndex ? " now" : ""}`}
            title={`${formatHourLabel(w.time, hourCycle)}${w.reasons.length ? " · " + w.reasons.join(", ") : " · good conditions"}`}
            aria-label={`${formatHourLabel(w.time, hourCycle)}: ${w.tone}${w.reasons.length ? " — " + w.reasons.join(", ") : ""}`}
          />
        ))}
      </div>
      <div className="flight-window-ticks">
        {tickIndices.map((i) => (
          <span key={i}>{formatHourLabel(windows[i].time, hourCycle)}</span>
        ))}
      </div>
    </div>
  );
}
