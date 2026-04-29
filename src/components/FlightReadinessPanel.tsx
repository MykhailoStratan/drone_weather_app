import type { AircraftProfile } from "../lib/aircraftProfiles";
import { temperatureDisplay, visibilityDisplay, windSpeedDisplay } from "../lib/format";
import type { DailyWeather, WeatherSnapshot } from "../types";

type FlightReadinessPanelProps = {
  aircraftProfile: AircraftProfile;
  currentDay: DailyWeather;
  currentSnapshot: WeatherSnapshot;
  temperatureUnit: "c" | "f";
  windUnit: "kmh" | "mph";
  windUnitLabel: string;
  visibilityUnit: "km" | "mi";
  visibilityUnitLabel: string;
};

type ReadinessTone = "good" | "caution" | "risk";

export function FlightReadinessPanel({
  aircraftProfile,
  currentDay,
  currentSnapshot,
  temperatureUnit,
  windUnit,
  windUnitLabel,
  visibilityUnit,
  visibilityUnitLabel,
}: FlightReadinessPanelProps) {
  const windTone = windConditionTone({
    gustKmh: currentSnapshot.windGusts,
    maxGustKmh: aircraftProfile.maxGustKmh,
    maxWindKmh: aircraftProfile.maxWindKmh,
    speedKmh: currentSnapshot.windSpeed,
  });
  const visibilityKm = currentSnapshot.visibility / 1000;
  const visibilityTone = visibilityKm < 6 ? (visibilityKm < 3 ? "risk" : "caution") : "good";
  const rainTone = rainConditionTone(currentDay.precipitationProbabilityMax, aircraftProfile.maxRainProbability);
  const temperatureTone = temperatureConditionTone(
    currentSnapshot.temperature,
    aircraftProfile.minTempC,
    aircraftProfile.maxTempC,
  );
  const overallScore = Math.round(
    (toneScore(windTone) + toneScore(visibilityTone) + toneScore(rainTone) + toneScore(temperatureTone)) / 4,
  );
  const tone = scoreTone(overallScore);
  const overallLabel = scoreLabel(overallScore);
  const summary = buildSummary({
    aircraftProfile,
    currentDay,
    currentSnapshot,
    visibilityKm,
  });

  return (
    <div className="readiness-panel">
      <div className="readiness-header">
        <div>
          <p className="section-label">Flight Readiness</p>
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
          value={windTone === "risk" ? "Over limit" : windTone === "caution" ? "Near limit" : "Inside limit"}
          status={`${windSpeedDisplay(currentSnapshot.windSpeed, windUnit)} ${windUnitLabel} sustained, ${windSpeedDisplay(currentSnapshot.windGusts, windUnit)} ${windUnitLabel} gusts / ${aircraftProfile.maxWindKmh}-${aircraftProfile.maxGustKmh} limits`}
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
          value={rainTone === "risk" ? "Over limit" : rainTone === "caution" ? "Near limit" : "Inside limit"}
          status={`${Math.round(currentDay.precipitationProbabilityMax)}% chance / ${aircraftProfile.maxRainProbability}% limit`}
          tone={rainTone}
        />
        <ReadinessChip
          label="Temperature"
          value={temperatureTone === "risk" ? "Outside range" : temperatureTone === "caution" ? "Near edge" : "In range"}
          status={`${temperatureDisplay(currentSnapshot.temperature, temperatureUnit)} ${temperatureUnit.toUpperCase()} / ${aircraftProfile.minTempC}-${aircraftProfile.maxTempC} C`}
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
  tone: ReadinessTone;
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

function toneScore(tone: ReadinessTone) {
  if (tone === "good") {
    return 90;
  }
  if (tone === "caution") {
    return 62;
  }
  return 32;
}

function windConditionTone({
  gustKmh,
  maxGustKmh,
  maxWindKmh,
  speedKmh,
}: {
  gustKmh: number;
  maxGustKmh: number;
  maxWindKmh: number;
  speedKmh: number;
}) {
  if (gustKmh > maxGustKmh || speedKmh > maxWindKmh) return "risk" as const;
  if (gustKmh >= maxGustKmh * 0.75 || speedKmh >= maxWindKmh * 0.75) return "caution" as const;
  return "good" as const;
}

function rainConditionTone(probability: number, limit: number) {
  if (probability > limit) return "risk" as const;
  if (probability >= limit * 0.6) return "caution" as const;
  return "good" as const;
}

function temperatureConditionTone(tempC: number, minTempC: number, maxTempC: number) {
  if (tempC < minTempC || tempC > maxTempC) return "risk" as const;
  if (tempC <= minTempC + 5 || tempC >= maxTempC - 5) return "caution" as const;
  return "good" as const;
}

function buildSummary({
  aircraftProfile,
  currentDay,
  currentSnapshot,
  visibilityKm,
}: {
  aircraftProfile: AircraftProfile;
  currentDay: DailyWeather;
  currentSnapshot: WeatherSnapshot;
  visibilityKm: number;
}) {
  const concerns: string[] = [];

  if (currentSnapshot.windGusts > aircraftProfile.maxGustKmh || currentSnapshot.windSpeed > aircraftProfile.maxWindKmh) {
    concerns.push(`wind is over the ${aircraftProfile.name} profile`);
  } else if (
    currentSnapshot.windGusts >= aircraftProfile.maxGustKmh * 0.75 ||
    currentSnapshot.windSpeed >= aircraftProfile.maxWindKmh * 0.75
  ) {
    concerns.push(`wind is nearing the ${aircraftProfile.name} profile`);
  }
  if (visibilityKm < 6) {
    concerns.push(`visibility is down to ${visibilityKm.toFixed(1)} km`);
  }
  if (currentDay.precipitationProbabilityMax > aircraftProfile.maxRainProbability) {
    concerns.push(`${Math.round(currentDay.precipitationProbabilityMax)}% rain potential exceeds the profile`);
  }
  if (currentSnapshot.temperature < aircraftProfile.minTempC || currentSnapshot.temperature > aircraftProfile.maxTempC) {
    concerns.push(`temperature is outside the ${aircraftProfile.minTempC}-${aircraftProfile.maxTempC} C range`);
  }

  if (concerns.length === 0) {
    return `${aircraftProfile.name} limits are clear for wind, rain, visibility, and temperature.`;
  }

  return `Most limiting factors right now: ${concerns.join(", ")}.`;
}
