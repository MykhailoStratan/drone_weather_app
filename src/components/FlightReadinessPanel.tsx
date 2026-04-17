import { visibilityDisplay, windSpeedDisplay } from "../lib/format";
import type { GnssEnvironmentPreset } from "../lib/weather";
import type { DailyWeather, GnssEstimateResponse, WeatherSnapshot } from "../types";

type FlightReadinessPanelProps = {
  currentDay: DailyWeather;
  currentSnapshot: WeatherSnapshot;
  environmentPreset: GnssEnvironmentPreset;
  onEnvironmentChange: (value: GnssEnvironmentPreset) => void;
  gnssEstimate: GnssEstimateResponse | null;
  loading: boolean;
  windUnit: "kmh" | "mph";
  windUnitLabel: string;
  visibilityUnit: "km" | "mi";
  visibilityUnitLabel: string;
};

export function FlightReadinessPanel({
  currentDay,
  currentSnapshot,
  environmentPreset,
  onEnvironmentChange,
  gnssEstimate,
  loading,
  windUnit,
  windUnitLabel,
  visibilityUnit,
  visibilityUnitLabel,
}: FlightReadinessPanelProps) {
  const overallScore = gnssEstimate?.gnssScore ?? 0;
  const overallLabel = gnssEstimate ? scoreLabel(overallScore) : "Loading GNSS";
  const tone = scoreTone(overallScore);
  const windTone = currentDay.windGustsMax >= 28 ? "risk" : currentDay.windGustsMax >= 18 ? "caution" : "good";
  const visibilityKm = currentSnapshot.visibility / 1000;
  const visibilityTone = visibilityKm < 6 ? (visibilityKm < 3 ? "risk" : "caution") : "good";
  const rainTone =
    currentDay.precipitationProbabilityMax >= 40
      ? currentDay.precipitationProbabilityMax >= 70
        ? "risk"
        : "caution"
      : "good";

  return (
    <div className="readiness-panel">
      <div className="readiness-header">
        <div>
          <p className="section-label">Flight readiness</p>
          <h3>{overallLabel}</h3>
        </div>
        <div className={`readiness-score ${tone}`}>
          <strong>{loading && !gnssEstimate ? "--" : gnssEstimate?.gnssScore ?? "--"}</strong>
          <span>/100</span>
        </div>
      </div>

      <div className="environment-row">
        <label className="preference-label" htmlFor="environment-preset">
          Flight environment
        </label>
        <select
          id="environment-preset"
          className="environment-select"
          value={environmentPreset}
          onChange={(event) => onEnvironmentChange(event.target.value as GnssEnvironmentPreset)}
        >
          <option value="open">Open field</option>
          <option value="suburban">Suburban</option>
          <option value="urban">Urban canyon</option>
          <option value="trees">Trees / hills</option>
        </select>
      </div>

      <div className="readiness-chip-grid">
        <ReadinessChip
          label="GNSS"
          value={loading && !gnssEstimate ? "Loading" : `${gnssEstimate?.gnssScore ?? "--"}`}
          status={
            loading && !gnssEstimate
              ? "Fetching constellation data"
              : `${gnssEstimate?.estimatedUsableSatellites ?? 0} usable / ${gnssEstimate?.estimatedVisibleSatellites ?? 0} visible`
          }
          tone={tone}
        />
        <ReadinessChip
          label="Wind"
          value={currentDay.windGustsMax >= 40 ? "High" : currentDay.windGustsMax >= 28 ? "Caution" : currentDay.windGustsMax >= 18 ? "Moderate" : "Low"}
          status={`${windSpeedDisplay(currentDay.windGustsMax, windUnit)} ${windUnitLabel} gusts`}
          tone={windTone}
        />
        <ReadinessChip
          label="Visibility"
          value={visibilityKm < 3 ? "Weak" : visibilityKm < 6 ? "Caution" : "Strong"}
          status={`${visibilityDisplay(visibilityKm, visibilityUnit)} ${visibilityUnitLabel}`}
          tone={visibilityTone}
        />
        <ReadinessChip
          label="Rain"
          value={currentDay.precipitationProbabilityMax >= 70 ? "High" : currentDay.precipitationProbabilityMax >= 40 ? "Caution" : "Low"}
          status={`${Math.round(currentDay.precipitationProbabilityMax)}% chance`}
          tone={rainTone}
        />
      </div>

      <p className="readiness-summary">
        {loading && !gnssEstimate
          ? "Loading satellite geometry and space-weather conditions for this location."
          : gnssEstimate?.summary ?? "GNSS estimate is unavailable right now."}
      </p>
    </div>
  );
}

function ReadinessChip({
  label,
  value,
  status,
  tone,
}: {
  label: string;
  value: string;
  status: string;
  tone: "good" | "caution" | "risk";
}) {
  return (
    <div className={`readiness-chip ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{status}</small>
    </div>
  );
}

function scoreLabel(score: number) {
  if (score >= 85) {
    return "Excellent";
  }
  if (score >= 70) {
    return "Good";
  }
  if (score >= 50) {
    return "Use caution";
  }
  return "Not recommended";
}

function scoreTone(score: number) {
  if (score >= 70) {
    return "good" as const;
  }
  if (score >= 50) {
    return "caution" as const;
  }
  return "risk" as const;
}
