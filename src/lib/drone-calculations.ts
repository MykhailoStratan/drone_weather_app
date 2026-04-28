export type BatteryTone = "good" | "caution" | "risk";

export type BatteryEstimate = {
  efficiencyPct: number;
  tone: BatteryTone;
  flightImpact: string;
  advice: string;
};

// Approximate Li-Po usable-capacity vs ambient temperature curve, anchored
// to consumer drone (DJI) operating-temperature guidance and standard
// Li-Po discharge characterization papers:
//   - DJI Mavic 3 Intelligent Flight Battery operating range 5-40°C
//     (https://www.dji.com/mavic-3/specs); flight-time degrades sharply
//     below 0°C and above 40°C.
//   - Generic Li-Po discharge tests show ~20% usable capacity at -20°C
//     and a peak in the 20-25°C range, used as the curve shape.
// These are nominal values for piloting advice only; not a battery-management
// system. If you update the breakpoints, update the unit tests in
// drone-calculations.test.ts to match.
const BATTERY_BREAKPOINTS: ReadonlyArray<readonly [number, number]> = [
  [-20, 20],
  [-10, 38],
  [0, 58],
  [10, 78],
  [20, 94],
  [25, 100],
  [35, 97],
  [40, 88],
  [50, 70],
];

export function interpolateBatteryEfficiency(tempC: number): number {
  if (Number.isNaN(tempC)) return BATTERY_BREAKPOINTS[0][1];
  if (tempC <= BATTERY_BREAKPOINTS[0][0]) return BATTERY_BREAKPOINTS[0][1];
  if (tempC >= BATTERY_BREAKPOINTS[BATTERY_BREAKPOINTS.length - 1][0]) {
    return BATTERY_BREAKPOINTS[BATTERY_BREAKPOINTS.length - 1][1];
  }

  for (let i = 0; i < BATTERY_BREAKPOINTS.length - 1; i++) {
    const [t0, e0] = BATTERY_BREAKPOINTS[i];
    const [t1, e1] = BATTERY_BREAKPOINTS[i + 1];
    if (tempC >= t0 && tempC <= t1) {
      const ratio = (tempC - t0) / (t1 - t0);
      return Math.round(e0 + ratio * (e1 - e0));
    }
  }
  return 100;
}

export function estimateBattery(tempC: number): BatteryEstimate {
  const efficiencyPct = interpolateBatteryEfficiency(tempC);

  let tone: BatteryTone;
  if (efficiencyPct >= 85) {
    tone = "good";
  } else if (efficiencyPct >= 65) {
    tone = "caution";
  } else {
    tone = "risk";
  }

  const reduction = 100 - efficiencyPct;
  const flightImpact =
    reduction <= 5
      ? "Minimal impact on flight time"
      : reduction <= 20
        ? `~${reduction}% shorter flights expected`
        : `~${reduction}% shorter flights — plan extra batteries`;

  let advice: string;
  if (tempC < -10) {
    advice = "Batteries at serious risk — store and pre-warm to 20 °C before use.";
  } else if (tempC < 5) {
    advice = "Pre-warm batteries to room temperature before powering on.";
  } else if (tempC < 15) {
    advice = "Cool conditions — keep batteries insulated until launch.";
  } else if (tempC <= 35) {
    advice = "Optimal temperature range for Li-Po batteries.";
  } else if (tempC <= 45) {
    advice = "Hot conditions — avoid leaving batteries in direct sunlight.";
  } else {
    advice = "Dangerously hot — risk of swelling or thermal runaway. Ground flight.";
  }

  return { efficiencyPct, tone, flightImpact, advice };
}

export type DensityAltitudeTone = "good" | "caution" | "risk";

export type DensityAltitudeResult = {
  pressureAltM: number;
  densityAltM: number;
  isaDeviationC: number;
  liftPenaltyPct: number;
};

const SEA_LEVEL_PRESSURE_HPA = 1013.25;
const ISA_LAPSE_RATE_C_PER_M = 0.0065;
const DENSITY_ALT_LAPSE = 0.00649;
const SERVICE_CEILING_M = 12_192;

export function computeDensityAltitude(
  tempC: number,
  pressureHPa: number,
): DensityAltitudeResult {
  const pressureAltM =
    (1 - Math.pow(pressureHPa / SEA_LEVEL_PRESSURE_HPA, 0.190284)) * 44330.76;
  const isaAtPaC = 15 - ISA_LAPSE_RATE_C_PER_M * pressureAltM;
  const isaDeviationC = tempC - isaAtPaC;
  const densityAltM = pressureAltM + isaDeviationC / DENSITY_ALT_LAPSE;
  const liftPenaltyPct = Math.max(0, Math.round((densityAltM / SERVICE_CEILING_M) * 100));
  return { pressureAltM, densityAltM, isaDeviationC, liftPenaltyPct };
}

export function densityAltitudeTone(densityAltM: number): DensityAltitudeTone {
  if (densityAltM < 1000) return "good";
  if (densityAltM < 2500) return "caution";
  return "risk";
}

export function metersToFeet(meters: number): number {
  return Math.round(meters * 3.28084);
}

export type CondensationRisk = "low" | "moderate" | "high";

export function dewPointCelsius(tempC: number, relativeHumidity: number): number {
  const a = 17.625;
  const b = 243.04;
  const gamma = Math.log(relativeHumidity / 100) + (a * tempC) / (b + tempC);
  return (b * gamma) / (a - gamma);
}

export function condensationRisk(spreadC: number): CondensationRisk {
  if (spreadC < 2) return "high";
  if (spreadC < 5) return "moderate";
  return "low";
}
