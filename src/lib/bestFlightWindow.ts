import type { AircraftProfile } from "./aircraftProfiles";
import type { WeatherSnapshot } from "../types";

export type FlightWindowTone = "good" | "caution" | "risk";

export type RatedFlightHour = {
  score: number;
  snapshot: WeatherSnapshot;
  tone: FlightWindowTone;
  reasons: string[];
};

export type BestFlightWindow =
  | {
      type: "window";
      startTime: string;
      endTime: string;
      durationHours: number;
      score: number;
      tone: FlightWindowTone;
      reasons: string[];
    }
  | {
      type: "fallback";
      startTime: string;
      endTime: string;
      durationHours: 1;
      score: number;
      tone: FlightWindowTone;
      reasons: string[];
    }
  | {
      type: "none";
      reasons: string[];
    };

export function rateFlightHour(snapshot: WeatherSnapshot, aircraftProfile: AircraftProfile): RatedFlightHour {
  let score = 100;
  let worstTone: FlightWindowTone = "good";
  const reasons: string[] = [];

  const windRatio = Math.max(
    ratio(snapshot.windSpeed, aircraftProfile.maxWindKmh),
    ratio(snapshot.windGusts, aircraftProfile.maxGustKmh),
  );
  if (windRatio > 1) {
    score -= 45;
    worstTone = escalateTone(worstTone, "risk");
    reasons.push("wind over profile limits");
  } else if (windRatio >= 0.75) {
    score -= 18;
    worstTone = escalateTone(worstTone, "caution");
    reasons.push("wind near profile limits");
  }

  const rainRatio = ratio(snapshot.precipitationProbability, aircraftProfile.maxRainProbability);
  if (rainRatio > 1) {
    score -= 35;
    worstTone = escalateTone(worstTone, "risk");
    reasons.push("rain chance over profile limit");
  } else if (rainRatio >= 0.6) {
    score -= 12;
    worstTone = escalateTone(worstTone, "caution");
    reasons.push("rain chance near profile limit");
  }

  const visibilityKm = snapshot.visibility / 1000;
  if (visibilityKm < 3) {
    score -= 40;
    worstTone = escalateTone(worstTone, "risk");
    reasons.push("visibility below 3 km");
  } else if (visibilityKm < 6) {
    score -= 16;
    worstTone = escalateTone(worstTone, "caution");
    reasons.push("visibility below 6 km");
  }

  if (snapshot.temperature < aircraftProfile.minTempC || snapshot.temperature > aircraftProfile.maxTempC) {
    score -= 35;
    worstTone = escalateTone(worstTone, "risk");
    reasons.push("temperature outside profile range");
  } else if (
    snapshot.temperature <= aircraftProfile.minTempC + 5 ||
    snapshot.temperature >= aircraftProfile.maxTempC - 5
  ) {
    score -= 12;
    worstTone = escalateTone(worstTone, "caution");
    reasons.push("temperature near profile edge");
  }

  if (snapshot.isDay !== 1) {
    score -= 18;
    worstTone = escalateTone(worstTone, "caution");
    reasons.push("outside daylight");
  }

  if (snapshot.cloudCover >= 90) {
    score -= 8;
    worstTone = escalateTone(worstTone, "caution");
    reasons.push("heavy cloud cover");
  }

  const clampedScore = Math.max(0, Math.round(score));
  return {
    score: clampedScore,
    snapshot,
    tone: scoreToTone(clampedScore, worstTone),
    reasons,
  };
}

export function findBestFlightWindow(
  hourlyForDay: WeatherSnapshot[],
  aircraftProfile: AircraftProfile,
): BestFlightWindow {
  if (hourlyForDay.length === 0) {
    return {
      type: "none",
      reasons: ["Hourly forecast is still loading."],
    };
  }

  const ratedHours = hourlyForDay.map((snapshot) => rateFlightHour(snapshot, aircraftProfile));
  const goodRuns = collectGoodRuns(ratedHours);

  if (goodRuns.length > 0) {
    const bestRun = goodRuns.sort(compareRuns)[0];
    const first = bestRun[0];
    const last = bestRun[bestRun.length - 1];
    return {
      type: "window",
      startTime: first.snapshot.time,
      endTime: addHours(last.snapshot.time, 1),
      durationHours: bestRun.length,
      score: averageScore(bestRun),
      tone: "good",
      reasons: summarizeRun(bestRun),
    };
  }

  const bestHour = [...ratedHours].sort((a, b) => b.score - a.score)[0];
  return {
    type: "fallback",
    startTime: bestHour.snapshot.time,
    endTime: addHours(bestHour.snapshot.time, 1),
    durationHours: 1,
    score: bestHour.score,
    tone: bestHour.tone,
    reasons: bestHour.reasons.length > 0 ? bestHour.reasons.slice(0, 2) : ["Most favorable single hour."],
  };
}

function ratio(value: number, limit: number) {
  return limit <= 0 ? Number.POSITIVE_INFINITY : value / limit;
}

function scoreToTone(score: number, worstTone: FlightWindowTone): FlightWindowTone {
  if (score < 62) return "risk";
  if (worstTone === "risk") return "risk";
  if (score < 82 || worstTone === "caution") return "caution";
  return "good";
}

function escalateTone(current: FlightWindowTone, next: FlightWindowTone): FlightWindowTone {
  const rank: Record<FlightWindowTone, number> = { good: 0, caution: 1, risk: 2 };
  if (rank[next] > rank[current]) return next;
  return current;
}

function collectGoodRuns(ratedHours: RatedFlightHour[]) {
  const runs: RatedFlightHour[][] = [];
  let currentRun: RatedFlightHour[] = [];

  for (const hour of ratedHours) {
    if (hour.tone === "good") {
      currentRun.push(hour);
    } else if (currentRun.length > 0) {
      runs.push(currentRun);
      currentRun = [];
    }
  }

  if (currentRun.length > 0) runs.push(currentRun);
  return runs;
}

function compareRuns(a: RatedFlightHour[], b: RatedFlightHour[]) {
  if (b.length !== a.length) return b.length - a.length;
  return averageScore(b) - averageScore(a);
}

function averageScore(hours: RatedFlightHour[]) {
  return Math.round(hours.reduce((total, hour) => total + hour.score, 0) / hours.length);
}

function summarizeRun(run: RatedFlightHour[]) {
  const allReasons = new Set(run.flatMap((hour) => hour.reasons));
  if (allReasons.size === 0) {
    return ["Profile limits clear through this window."];
  }
  return Array.from(allReasons).slice(0, 2);
}

function addHours(time: string, hours: number) {
  const naive = !time.endsWith("Z") && !/[+-]\d{2}:\d{2}$/.test(time);
  const date = new Date(naive ? `${time}Z` : time);
  date.setUTCHours(date.getUTCHours() + hours);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const hour = String(date.getUTCHours()).padStart(2, "0");
  const minute = String(date.getUTCMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hour}:${minute}`;
}
