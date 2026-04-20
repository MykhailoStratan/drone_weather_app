import type { WeatherSnapshot } from "../types";
import { formatHourLabel } from "../lib/format";

type WindowTone = "good" | "caution" | "risk";

type HourWindow = {
  time: string;
  tone: WindowTone;
  reasons: string[];
};

const TONE_RANK: Record<WindowTone, number> = { good: 0, caution: 1, risk: 2 };

function escalate(current: WindowTone, next: WindowTone): WindowTone {
  return TONE_RANK[next] > TONE_RANK[current] ? next : current;
}

function classifyHour(snap: WeatherSnapshot): HourWindow {
  const reasons: string[] = [];
  let worst: WindowTone = "good";

  const gustsKmh = snap.windGusts;
  if (gustsKmh >= 28) { worst = escalate(worst, "risk"); reasons.push(`gusts ${Math.round(gustsKmh)} km/h`); }
  else if (gustsKmh >= 18) { worst = escalate(worst, "caution"); reasons.push(`gusts ${Math.round(gustsKmh)} km/h`); }

  const rainPct = snap.precipitationProbability;
  if (rainPct >= 60) { worst = escalate(worst, "risk"); reasons.push(`rain ${Math.round(rainPct)}%`); }
  else if (rainPct >= 30) { worst = escalate(worst, "caution"); reasons.push(`rain ${Math.round(rainPct)}%`); }

  const visKm = snap.visibility / 1000;
  if (visKm < 3) { worst = escalate(worst, "risk"); reasons.push(`vis ${visKm.toFixed(1)} km`); }
  else if (visKm < 6) { worst = escalate(worst, "caution"); reasons.push(`vis ${visKm.toFixed(1)} km`); }

  if (snap.cloudCover >= 90) { worst = escalate(worst, "caution"); }

  return { time: snap.time, tone: worst, reasons };
}

export function HourScrubber({
  hourlyForDay,
  hourCycle,
  activeHourIndex,
  onHourChange,
}: {
  hourlyForDay: WeatherSnapshot[];
  hourCycle: "12h" | "24h";
  activeHourIndex: number;
  onHourChange: (index: number) => void;
}) {
  if (hourlyForDay.length === 0) return null;

  const windows: HourWindow[] = hourlyForDay.map(classifyHour);

  const nowMs = Date.now();
  const nowIndex = hourlyForDay.reduce((closest, snap, i) =>
    Math.abs(new Date(snap.time).getTime() - nowMs) <
    Math.abs(new Date(hourlyForDay[closest].time).getTime() - nowMs)
      ? i : closest,
    0,
  );

  const goodCount = windows.filter((w) => w.tone === "good").length;
  const summary =
    goodCount === windows.length
      ? "All clear"
      : goodCount === 0
      ? "No safe windows"
      : `${goodCount}/${windows.length}h flyable`;

  const tickIndices = [0, Math.floor((windows.length - 1) / 2), windows.length - 1];
  const activeSnap = hourlyForDay[activeHourIndex];
  const activeLabel = activeSnap ? formatHourLabel(activeSnap.time, hourCycle) : "";

  // Center the thumb within the selected segment
  const thumbPct = windows.length > 1
    ? ((activeHourIndex + 0.5) / windows.length) * 100
    : 50;

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowRight" || e.key === "ArrowUp") {
      e.preventDefault();
      onHourChange(Math.min(activeHourIndex + 1, windows.length - 1));
    } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
      e.preventDefault();
      onHourChange(Math.max(activeHourIndex - 1, 0));
    }
  }

  return (
    <div className="hour-scrubber">
      <div className="hour-scrubber-header">
        <div>
          <span className="section-label">Hour scrubber</span>
          <strong>{activeLabel}</strong>
        </div>
        <span className="hour-scrubber-summary">{summary}</span>
      </div>

      <div
        className="hour-scrubber-track-wrap"
        role="slider"
        aria-valuenow={activeHourIndex}
        aria-valuemin={0}
        aria-valuemax={windows.length - 1}
        aria-valuetext={activeLabel}
        aria-label="Select forecast hour"
        tabIndex={0}
        onKeyDown={handleKeyDown}
      >
        <div className="hour-scrubber-bar">
          {windows.map((w, i) => (
            <div
              key={w.time}
              className={`hour-scrubber-seg ${w.tone}${i === activeHourIndex ? " selected" : ""}${i === nowIndex ? " now" : ""}`}
              onClick={() => onHourChange(i)}
              title={`${formatHourLabel(w.time, hourCycle)}${w.reasons.length ? " · " + w.reasons.join(", ") : " · good conditions"}`}
            />
          ))}
        </div>
        <div
          className="hour-scrubber-thumb"
          style={{ left: `${thumbPct}%` }}
          aria-hidden="true"
        />
      </div>

      <div className="hour-scrubber-ticks" aria-hidden="true">
        {tickIndices.map((i) => (
          <span key={i}>{formatHourLabel(windows[i].time, hourCycle)}</span>
        ))}
      </div>
    </div>
  );
}
