import type { AircraftProfile } from "../lib/aircraftProfiles";
import { findBestFlightWindow } from "../lib/bestFlightWindow";
import { formatTime } from "../lib/format";
import type { WeatherSnapshot } from "../types";

type BestFlightWindowPanelProps = {
  aircraftProfile: AircraftProfile;
  hourCycle: "12h" | "24h";
  hourlyForDay: WeatherSnapshot[];
};

export function BestFlightWindowPanel({
  aircraftProfile,
  hourCycle,
  hourlyForDay,
}: BestFlightWindowPanelProps) {
  const bestWindow = findBestFlightWindow(hourlyForDay, aircraftProfile);

  if (bestWindow.type === "none") {
    return (
      <div className="best-flight-window-card muted">
        <div>
          <p className="section-label">Best Flight Window</p>
          <strong>Loading hourly data</strong>
        </div>
        <span>{bestWindow.reasons[0]}</span>
      </div>
    );
  }

  const timeLabel = `${formatTime(bestWindow.startTime, hourCycle)} - ${formatTime(bestWindow.endTime, hourCycle)}`;
  const badgeLabel =
    bestWindow.type === "window"
      ? `${bestWindow.durationHours}h strong`
      : "Best fallback";

  return (
    <div className={`best-flight-window-card ${bestWindow.tone}`}>
      <div className="best-flight-window-main">
        <div>
          <p className="section-label">Best Flight Window</p>
          <strong>{timeLabel}</strong>
        </div>
        <span className={`best-flight-window-badge ${bestWindow.tone}`}>{badgeLabel}</span>
      </div>
      <p>
        {bestWindow.reasons.join(", ")}
      </p>
      <small>
        {aircraftProfile.name} profile - score {bestWindow.score}/100
      </small>
    </div>
  );
}
