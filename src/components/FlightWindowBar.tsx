import { useRef, useState } from "react";
import type { WeatherSnapshot } from "../types";
import { formatHourLabel } from "../lib/format";

export type WindowTone = "good" | "caution" | "risk";

export type HourRiskReason = {
  metric: string;
  value: string;
  threshold: string;
  tone: Exclude<WindowTone, "good">;
};

type HourWindow = {
  time: string;
  tone: WindowTone;
  reasons: string[];
  riskReasons: HourRiskReason[];
};

type TimelineSnapshotEntry = {
  absIndex: number;
  snapshot: WeatherSnapshot;
};

export type HourScrubberBoundary = {
  leftTime: string | null;
  rightTime: string | null;
};

const TONE_RANK: Record<WindowTone, number> = { good: 0, caution: 1, risk: 2 };

// Fixed window: 11 past hours + now + 12 future hours = 24 total slots
const PAST_SLOTS = 11;
const FUTURE_SLOTS = 12;
const TOTAL_SLOTS = PAST_SLOTS + 1 + FUTURE_SLOTS; // 24

const visuallyHiddenInputStyle = {
  position: "absolute",
  width: "1px",
  height: "1px",
  padding: 0,
  margin: "-1px",
  overflow: "hidden",
  clip: "rect(0, 0, 0, 0)",
  whiteSpace: "nowrap",
  border: 0,
} as const;

function escalate(current: WindowTone, next: WindowTone): WindowTone {
  return TONE_RANK[next] > TONE_RANK[current] ? next : current;
}

export function getHourRiskDetails(snap: WeatherSnapshot): HourWindow {
  const riskReasons: HourRiskReason[] = [];
  let worst: WindowTone = "good";

  const gustsKmh = snap.windGusts;
  if (gustsKmh >= 28) {
    worst = escalate(worst, "risk");
    riskReasons.push({
      metric: "Wind gusts",
      value: `${Math.round(gustsKmh)} km/h`,
      threshold: "Caution at 28 km/h or higher",
      tone: "risk",
    });
  } else if (gustsKmh >= 18) {
    worst = escalate(worst, "caution");
    riskReasons.push({
      metric: "Wind gusts",
      value: `${Math.round(gustsKmh)} km/h`,
      threshold: "Moderate at 18 km/h or higher",
      tone: "caution",
    });
  }

  const rainPct = snap.precipitationProbability;
  if (rainPct >= 60) {
    worst = escalate(worst, "risk");
    riskReasons.push({
      metric: "Rain probability",
      value: `${Math.round(rainPct)}%`,
      threshold: "Caution at 60% or higher",
      tone: "risk",
    });
  } else if (rainPct >= 30) {
    worst = escalate(worst, "caution");
    riskReasons.push({
      metric: "Rain probability",
      value: `${Math.round(rainPct)}%`,
      threshold: "Moderate at 30% or higher",
      tone: "caution",
    });
  }

  const visKm = snap.visibility / 1000;
  if (visKm < 3) {
    worst = escalate(worst, "risk");
    riskReasons.push({
      metric: "Visibility",
      value: `${visKm.toFixed(1)} km`,
      threshold: "Caution below 3.0 km",
      tone: "risk",
    });
  } else if (visKm < 6) {
    worst = escalate(worst, "caution");
    riskReasons.push({
      metric: "Visibility",
      value: `${visKm.toFixed(1)} km`,
      threshold: "Moderate below 6.0 km",
      tone: "caution",
    });
  }

  if (snap.cloudCover >= 90) {
    worst = escalate(worst, "caution");
    riskReasons.push({
      metric: "Cloud cover",
      value: `${Math.round(snap.cloudCover)}%`,
      threshold: "Moderate at 90% or higher",
      tone: "caution",
    });
  }

  return {
    time: snap.time,
    tone: worst,
    reasons: riskReasons.map((reason) => `${reason.metric.toLowerCase()} ${reason.value}`),
    riskReasons,
  };
}

function buildTimelineSnapshotEntries({
  hourlyForDay,
  nextDayHourly = [],
  prevDayHourly = [],
}: {
  hourlyForDay: WeatherSnapshot[];
  nextDayHourly?: WeatherSnapshot[];
  prevDayHourly?: WeatherSnapshot[];
}): TimelineSnapshotEntry[] {
  return [
    ...prevDayHourly.map((snapshot, index) => ({
      absIndex: index - prevDayHourly.length,
      snapshot,
    })),
    ...hourlyForDay.map((snapshot, index) => ({
      absIndex: index,
      snapshot,
    })),
    ...nextDayHourly.map((snapshot, index) => ({
      absIndex: hourlyForDay.length + index,
      snapshot,
    })),
  ];
}

function findTimelineSlotStart(entries: TimelineSnapshotEntry[]) {
  const nowMs = Date.now();
  const nowEntry = entries.reduce((closest, entry) =>
    Math.abs(new Date(entry.snapshot.time).getTime() - nowMs) <
    Math.abs(new Date(closest.snapshot.time).getTime() - nowMs)
      ? entry
      : closest,
  );

  return nowEntry.absIndex - PAST_SLOTS;
}

export function getHourScrubberBoundary({
  hourlyForDay,
  nextDayHourly = [],
  prevDayHourly = [],
  centerOnCurrentTime = true,
}: {
  hourlyForDay: WeatherSnapshot[];
  nextDayHourly?: WeatherSnapshot[];
  prevDayHourly?: WeatherSnapshot[];
  centerOnCurrentTime?: boolean;
}): HourScrubberBoundary {
  if (hourlyForDay.length === 0) {
    return { leftTime: null, rightTime: null };
  }

  if (!centerOnCurrentTime) {
    return {
      leftTime: hourlyForDay[0]?.time ?? null,
      rightTime: hourlyForDay[Math.min(hourlyForDay.length, TOTAL_SLOTS) - 1]?.time ?? null,
    };
  }

  const allEntries = buildTimelineSnapshotEntries({ hourlyForDay, nextDayHourly, prevDayHourly });
  const slotStart = findTimelineSlotStart(allEntries);
  const leftAbsIndex = slotStart;
  const rightAbsIndex = slotStart + TOTAL_SLOTS - 1;

  return {
    leftTime: allEntries.find((entry) => entry.absIndex === leftAbsIndex)?.snapshot.time ?? null,
    rightTime: allEntries.find((entry) => entry.absIndex === rightAbsIndex)?.snapshot.time ?? null,
  };
}

export function getHourScrubberVisibleSnapshots({
  hourlyForDay,
  nextDayHourly = [],
  prevDayHourly = [],
  centerOnCurrentTime = true,
}: {
  hourlyForDay: WeatherSnapshot[];
  nextDayHourly?: WeatherSnapshot[];
  prevDayHourly?: WeatherSnapshot[];
  centerOnCurrentTime?: boolean;
}): WeatherSnapshot[] {
  if (hourlyForDay.length === 0) {
    return [];
  }

  if (!centerOnCurrentTime) {
    return hourlyForDay.slice(0, TOTAL_SLOTS);
  }

  const allEntries = buildTimelineSnapshotEntries({ hourlyForDay, nextDayHourly, prevDayHourly });
  const slotStart = findTimelineSlotStart(allEntries);
  const slotEnd = slotStart + TOTAL_SLOTS - 1;

  return allEntries
    .filter((entry) => entry.absIndex >= slotStart && entry.absIndex <= slotEnd)
    .map((entry) => entry.snapshot);
}

export function HourScrubber({
  hourlyForDay,
  nextDayHourly = [],
  prevDayHourly = [],
  hourCycle,
  activeHourIndex,
  onHourChange,
  onNextDayHourChange,
  onPrevDayHourChange,
  centerOnCurrentTime = true,
}: {
  hourlyForDay: WeatherSnapshot[];
  nextDayHourly?: WeatherSnapshot[];
  prevDayHourly?: WeatherSnapshot[];
  hourCycle: "12h" | "24h";
  activeHourIndex: number;
  onHourChange: (index: number) => void;
  onNextDayHourChange?: (index: number) => void;
  onPrevDayHourChange?: (index: number) => void;
  centerOnCurrentTime?: boolean;
}) {
  if (hourlyForDay.length === 0) return null;

  const windows: HourWindow[] = hourlyForDay.map(getHourRiskDetails);
  const nextDayWindows = nextDayHourly.map(getHourRiskDetails);
  const prevDayWindows = prevDayHourly.map(getHourRiskDetails);

  type TimelineEntry = {
    absIndex: number;
    window: HourWindow;
    isNextDay: boolean;
    isPrevDay: boolean;
  };

  const timelineEntries: TimelineEntry[] = [
    ...prevDayWindows.map((window, index) => ({
      absIndex: index - prevDayWindows.length,
      window,
      isNextDay: false,
      isPrevDay: true,
    })),
    ...windows.map((window, index) => ({
      absIndex: index,
      window,
      isNextDay: false,
      isPrevDay: false,
    })),
    ...nextDayWindows.map((window, index) => ({
      absIndex: windows.length + index,
      window,
      isNextDay: true,
      isPrevDay: false,
    })),
  ];

  const nowEntry = centerOnCurrentTime
    ? timelineEntries.reduce((closest, entry) =>
        Math.abs(new Date(entry.window.time).getTime() - Date.now()) <
        Math.abs(new Date(closest.window.time).getTime() - Date.now())
          ? entry
          : closest,
      )
    : null;
  const nowAbsIndex = nowEntry?.absIndex ?? null;

  // Current day: center on now and allow cross-day clicks. Other dates: show the selected day from 00:00 to 23:00.
  const slotStart = centerOnCurrentTime && nowAbsIndex !== null ? nowAbsIndex - PAST_SLOTS : 0;

  type Slot = { absIndex: number; window: HourWindow | null; isNextDay: boolean; isPrevDay: boolean };
  const slots: Slot[] = Array.from({ length: TOTAL_SLOTS }, (_, i) => {
    const absI = slotStart + i;
    if (absI >= 0 && absI < windows.length) {
      return { absIndex: absI, window: windows[absI], isNextDay: false, isPrevDay: false };
    }
    if (!centerOnCurrentTime) {
      return { absIndex: absI, window: null, isNextDay: false, isPrevDay: false };
    }
    if (absI < 0) {
      // Underflow into previous day: absI=-1 → last hour of prev day, absI=-2 → second-last, etc.
      const prevI = prevDayWindows.length + absI;
      if (prevI >= 0) {
        return { absIndex: absI, window: prevDayWindows[prevI], isNextDay: false, isPrevDay: true };
      }
    } else {
      const nextI = absI - windows.length;
      if (nextI < nextDayWindows.length) {
        return { absIndex: absI, window: nextDayWindows[nextI], isNextDay: true, isPrevDay: false };
      }
    }
    return { absIndex: absI, window: null, isNextDay: false, isPrevDay: false };
  });

  const goodCount = windows.filter((w) => w.tone === "good").length;
  const summary =
    goodCount === windows.length
      ? "All clear"
      : goodCount === 0
      ? "No safe windows"
      : `${goodCount}/${windows.length}h flyable`;

  const activeSnap = hourlyForDay[activeHourIndex];
  const activeLabel = activeSnap ? formatHourLabel(activeSnap.time, hourCycle) : "";

  // Local slot index of the selected hour (may be outside [0, TOTAL_SLOTS-1] if user picks out-of-window hour)
  const selectedLocalIndex = Math.max(0, Math.min(TOTAL_SLOTS - 1, activeHourIndex - slotStart));
  const cursorLeftPct = (selectedLocalIndex / TOTAL_SLOTS) * 100;
  const cursorWidthPct = (1 / TOTAL_SLOTS) * 100;

  const barRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const dragStartX = useRef(0);
  const dragStartIndex = useRef(0);
  const dragSegWidth = useRef(0);

  function localIndexFromClientX(clientX: number): number {
    const rect = barRef.current?.getBoundingClientRect();
    if (!rect) return selectedLocalIndex;
    const ratio = (clientX - rect.left) / rect.width;
    return Math.max(0, Math.min(TOTAL_SLOTS - 1, Math.floor(ratio * TOTAL_SLOTS)));
  }

  function selectLocal(local: number) {
    const abs = slotStart + local;
    if (abs >= 0 && abs < windows.length) {
      onHourChange(abs);
    } else if (centerOnCurrentTime && abs >= windows.length) {
      const nextI = abs - windows.length;
      if (nextI < nextDayWindows.length) onNextDayHourChange?.(nextI);
    } else if (centerOnCurrentTime) {
      // abs < 0 → previous day
      const prevI = prevDayWindows.length + abs;
      if (prevI >= 0) onPrevDayHourChange?.(prevI);
    }
  }

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
    const local = localIndexFromClientX(e.clientX);
    selectLocal(local);
    dragStartX.current = e.clientX;
    dragStartIndex.current = local;
    dragSegWidth.current = barRef.current
      ? barRef.current.clientWidth / TOTAL_SLOTS
      : 12;
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
    const deltaSlots = Math.round((e.clientX - dragStartX.current) / dragSegWidth.current);
    const newLocal = Math.max(0, Math.min(TOTAL_SLOTS - 1, dragStartIndex.current + deltaSlots));
    selectLocal(newLocal);
  }

  function handlePointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    setDragging(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowRight" || e.key === "ArrowUp") {
      e.preventDefault();
      if (activeHourIndex < windows.length - 1) {
        onHourChange(activeHourIndex + 1);
      } else if (centerOnCurrentTime && nextDayWindows.length > 0) {
        onNextDayHourChange?.(0);
      }
    } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
      e.preventDefault();
      if (activeHourIndex > 0) {
        onHourChange(activeHourIndex - 1);
      } else if (centerOnCurrentTime && prevDayWindows.length > 0) {
        onPrevDayHourChange?.(prevDayWindows.length - 1);
      }
    }
  }

  const leftWin = slots[0].window;
  const rightWin = slots[TOTAL_SLOTS - 1].window;
  const leftLabel = leftWin ? formatHourLabel(leftWin.time, hourCycle) : "—";
  const middleWin = slots[PAST_SLOTS].window;
  const middleLabel = centerOnCurrentTime && nowEntry
    ? formatHourLabel(nowEntry.window.time, hourCycle)
    : middleWin
      ? formatHourLabel(middleWin.time, hourCycle)
      : "â€”";
  const rightLabel = rightWin ? formatHourLabel(rightWin.time, hourCycle) : "—";

  return (
    <div className="hour-scrubber">
      <div className="hour-scrubber-header">
        <div>
          <span className="section-label">Hourly Timeline</span>
          <strong>{activeLabel}</strong>
        </div>
        <span className="hour-scrubber-summary">{summary}</span>
      </div>

      <input
        type="range"
        min={0}
        max={Math.max(0, windows.length - 1)}
        step={1}
        value={Math.max(0, Math.min(activeHourIndex, windows.length - 1))}
        aria-label="Select forecast hour"
        aria-valuetext={activeLabel}
        onChange={(event) => {
          onHourChange(Number(event.target.value));
        }}
        onKeyDown={handleKeyDown}
        style={visuallyHiddenInputStyle}
      />

      <div
        className="hour-scrubber-track-wrap"
        aria-hidden="true"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        data-dragging={dragging || undefined}
      >
        <div className="hour-scrubber-bar" ref={barRef}>
          {slots.map((slot, localI) => {
            const isNow = centerOnCurrentTime && slot.absIndex === nowAbsIndex;
            const isSelected = slot.absIndex === activeHourIndex;
            const tone = slot.window?.tone ?? "empty";
            const title = slot.window
              ? `${formatHourLabel(slot.window.time, hourCycle)}${slot.window.reasons.length ? " · " + slot.window.reasons.join(", ") : " · good conditions"}`
              : undefined;
            return (
              <div
                key={localI}
                className={`hour-scrubber-seg ${tone}${isNow ? " now" : ""}${isSelected ? " selected" : ""}${slot.isNextDay ? " next-day" : ""}${slot.isPrevDay ? " prev-day" : ""}`}
                title={title}
              />
            );
          })}
          {/* Red border cursor for selected hour */}
          <div
            className="hour-scrubber-cursor"
            style={{
              left: `${cursorLeftPct}%`,
              width: `${cursorWidthPct}%`,
              transition: dragging ? "none" : "left 80ms ease",
            }}
            aria-hidden="true"
          />
        </div>
      </div>

      <div className="hour-scrubber-ticks" aria-hidden="true">
        <span>{leftLabel}</span>
        <span className="hour-scrubber-tick-now">{middleLabel}</span>
        <span>{rightLabel}</span>
      </div>
    </div>
  );
}
