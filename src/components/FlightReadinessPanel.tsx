import { temperatureDisplay, visibilityDisplay, windSpeedDisplay } from "../lib/format";
import type { DailyWeather, WeatherSnapshot } from "../types";

type FlightReadinessPanelProps = {
  currentDay: DailyWeather;
  currentSnapshot: WeatherSnapshot;
  temperatureUnit: "c" | "f";
  windUnit: "kmh" | "mph";
  windUnitLabel: string;
  visibilityUnit: "km" | "mi";
  visibilityUnitLabel: string;
};

export function FlightReadinessPanel({
  currentDay,
  currentSnapshot,
  temperatureUnit,
  windUnit,
  windUnitLabel,
  visibilityUnit,
  visibilityUnitLabel,
}: FlightReadinessPanelProps) {
  const windGust = currentSnapshot.windGusts;
  const windTone = windGust >= 28 ? "risk" : windGust >= 18 ? "caution" : "good";
  const visibilityKm = currentSnapshot.visibility / 1000;
  const visibilityTone = visibilityKm < 6 ? (visibilityKm < 3 ? "risk" : "caution") : "good";
  const rainTone =
    currentDay.precipitationProbabilityMax >= 40
      ? currentDay.precipitationProbabilityMax >= 70
        ? "risk"
        : "caution"
      : "good";
  const temperatureTone =
    currentSnapshot.temperature <= 0 || currentSnapshot.temperature >= 35
      ? "risk"
      : currentSnapshot.temperature <= 5 || currentSnapshot.temperature >= 30
        ? "caution"
        : "good";
  const overallScore = Math.round(
    (toneScore(windTone) + toneScore(visibilityTone) + toneScore(rainTone) + toneScore(temperatureTone)) / 4,
  );
  const tone = scoreTone(overallScore);
  const overallLabel = scoreLabel(overallScore);
  const summary = buildSummary({
    currentDay,
    currentSnapshot,
    visibilityKm,
  });

  return (
    <div className="readiness-panel">
      <div className="readiness-header">
        <div>
          <p className="section-label">Flight readiness</p>
          <h3>{overallLabel}</h3>
        </div>
        <div className={`readiness-score ${tone}`}>
          <strong>{overallScore}</strong>
          <span>/100</span>
        </div>
      </div>

      <div className="readiness-chip-grid">
        <ReadinessChip
          label="Wind"
          value={windGust >= 40 ? "High" : windGust >= 28 ? "Caution" : windGust >= 18 ? "Moderate" : "Low"}
          status={`${windSpeedDisplay(windGust, windUnit)} ${windUnitLabel} gusts`}
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
        <ReadinessChip
          label="Temperature"
          value={
            currentSnapshot.temperature <= 0 || currentSnapshot.temperature >= 35
              ? "Extreme"
              : currentSnapshot.temperature <= 5 || currentSnapshot.temperature >= 30
                ? "Watch"
                : "Stable"
          }
          status={`${temperatureDisplay(currentSnapshot.temperature, temperatureUnit)}°${temperatureUnit.toUpperCase()}`}
          tone={temperatureTone}
        />
      </div>

      <p className="readiness-summary">{summary}</p>
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

function toneScore(tone: "good" | "caution" | "risk") {
  if (tone === "good") {
    return 90;
  }
  if (tone === "caution") {
    return 62;
  }
  return 32;
}

function buildSummary({
  currentDay,
  currentSnapshot,
  visibilityKm,
}: {
  currentDay: DailyWeather;
  currentSnapshot: WeatherSnapshot;
  visibilityKm: number;
}) {
  const concerns: string[] = [];

  if (currentSnapshot.windGusts >= 28) {
    concerns.push(`gusts are reaching ${Math.round(currentSnapshot.windGusts)}`);
  }
  if (visibilityKm < 6) {
    concerns.push(`visibility is down to ${visibilityKm.toFixed(1)} km`);
  }
  if (currentDay.precipitationProbabilityMax >= 40) {
    concerns.push(`${Math.round(currentDay.precipitationProbabilityMax)}% rain potential`);
  }
  if (currentSnapshot.temperature <= 5 || currentSnapshot.temperature >= 30) {
    concerns.push(`temperature is ${Math.round(currentSnapshot.temperature)}°C`);
  }

  if (concerns.length === 0) {
    return "Visibility, wind, rain, and temperature are all within a comfortable range for a routine flight check.";
  }

  return `Most limiting factors right now: ${concerns.join(", ")}.`;
}
