import { describe, expect, it } from "vitest";
import {
  computeDensityAltitude,
  condensationRisk,
  densityAltitudeTone,
  dewPointCelsius,
  estimateBattery,
  interpolateBatteryEfficiency,
  metersToFeet,
} from "./drone-calculations";

describe("interpolateBatteryEfficiency", () => {
  it("clamps to the lowest breakpoint below the cold limit", () => {
    expect(interpolateBatteryEfficiency(-40)).toBe(20);
    expect(interpolateBatteryEfficiency(-20)).toBe(20);
  });

  it("clamps to the highest breakpoint above the hot limit", () => {
    expect(interpolateBatteryEfficiency(60)).toBe(70);
    expect(interpolateBatteryEfficiency(50)).toBe(70);
  });

  it("returns the exact value at a breakpoint", () => {
    expect(interpolateBatteryEfficiency(0)).toBe(58);
    expect(interpolateBatteryEfficiency(20)).toBe(94);
    expect(interpolateBatteryEfficiency(25)).toBe(100);
  });

  it("linearly interpolates between adjacent breakpoints", () => {
    // halfway between 10°C (78) and 20°C (94) -> 86
    expect(interpolateBatteryEfficiency(15)).toBe(86);
    // halfway between 0°C (58) and 10°C (78) -> 68
    expect(interpolateBatteryEfficiency(5)).toBe(68);
    // halfway between 35°C (97) and 40°C (88) -> 93 (rounded)
    expect(interpolateBatteryEfficiency(37.5)).toBe(93);
  });

  it("falls back to the cold limit on NaN input", () => {
    expect(interpolateBatteryEfficiency(Number.NaN)).toBe(20);
  });

  it("monotonically improves from -20°C to the 25°C peak", () => {
    let prev = interpolateBatteryEfficiency(-20);
    for (let t = -19; t <= 25; t++) {
      const next = interpolateBatteryEfficiency(t);
      expect(next).toBeGreaterThanOrEqual(prev);
      prev = next;
    }
  });

  it("monotonically degrades from the 25°C peak to 50°C", () => {
    let prev = interpolateBatteryEfficiency(25);
    for (let t = 26; t <= 50; t++) {
      const next = interpolateBatteryEfficiency(t);
      expect(next).toBeLessThanOrEqual(prev);
      prev = next;
    }
  });
});

describe("estimateBattery", () => {
  it("classifies the 25°C peak as 'good' with no impact text", () => {
    const result = estimateBattery(25);
    expect(result.efficiencyPct).toBe(100);
    expect(result.tone).toBe("good");
    expect(result.flightImpact).toBe("Minimal impact on flight time");
    expect(result.advice).toMatch(/optimal/i);
  });

  it("classifies severe cold (-15°C) as 'risk' with warning advice", () => {
    const result = estimateBattery(-15);
    expect(result.tone).toBe("risk");
    expect(result.efficiencyPct).toBeLessThan(40);
    expect(result.advice).toMatch(/serious risk/i);
  });

  it("returns thermal-runaway advice above 45°C even though efficiency stays at the 70% floor", () => {
    const result = estimateBattery(50);
    expect(result.efficiencyPct).toBe(70);
    expect(result.advice).toMatch(/thermal runaway|ground flight/i);
  });

  it("uses 'caution' tone when efficiency is between 65 and 84", () => {
    // 10°C -> 78%, between 65 and 84
    const result = estimateBattery(10);
    expect(result.tone).toBe("caution");
    expect(result.flightImpact).toMatch(/shorter flights/i);
  });

  it("uses pre-warm advice for cool but not freezing temperatures", () => {
    expect(estimateBattery(0).advice).toMatch(/pre-warm/i);
    expect(estimateBattery(4).advice).toMatch(/pre-warm/i);
  });

  it("crosses tone thresholds correctly at the 65 / 85 boundaries", () => {
    // tone is determined by efficiencyPct directly
    // verify tone for tempC values near boundaries
    expect(estimateBattery(-10).tone).toBe("risk"); // 38%
    expect(estimateBattery(0).tone).toBe("risk"); // 58% < 65
    expect(estimateBattery(10).tone).toBe("caution"); // 78%
    expect(estimateBattery(20).tone).toBe("good"); // 94%
  });
});

describe("computeDensityAltitude", () => {
  it("returns ~0 m density altitude at ISA standard conditions", () => {
    const { pressureAltM, densityAltM, isaDeviationC } = computeDensityAltitude(15, 1013.25);
    expect(Math.abs(pressureAltM)).toBeLessThan(1);
    expect(Math.abs(densityAltM)).toBeLessThan(2);
    expect(Math.abs(isaDeviationC)).toBeLessThan(0.05);
  });

  it("increases density altitude when air is hotter than ISA", () => {
    const standard = computeDensityAltitude(15, 1013.25);
    const hot = computeDensityAltitude(35, 1013.25);
    expect(hot.densityAltM).toBeGreaterThan(standard.densityAltM);
    expect(hot.isaDeviationC).toBeCloseTo(20, 0);
  });

  it("decreases density altitude when air is colder than ISA", () => {
    const cold = computeDensityAltitude(-10, 1013.25);
    expect(cold.densityAltM).toBeLessThan(0);
    expect(cold.isaDeviationC).toBeLessThan(0);
  });

  it("yields positive pressure altitude when ambient pressure is below sea-level", () => {
    const mountain = computeDensityAltitude(20, 850);
    expect(mountain.pressureAltM).toBeGreaterThan(1000);
  });

  it("clamps lift penalty at 0% when density altitude is negative", () => {
    const { liftPenaltyPct } = computeDensityAltitude(-20, 1020);
    expect(liftPenaltyPct).toBe(0);
  });

  it("scales lift penalty proportionally up to the service ceiling", () => {
    const high = computeDensityAltitude(35, 700);
    expect(high.liftPenaltyPct).toBeGreaterThan(20);
    expect(high.liftPenaltyPct).toBeLessThanOrEqual(100);
  });
});

describe("densityAltitudeTone", () => {
  it("classifies low density altitude as good", () => {
    expect(densityAltitudeTone(0)).toBe("good");
    expect(densityAltitudeTone(999)).toBe("good");
  });

  it("classifies mid-range density altitude as caution", () => {
    expect(densityAltitudeTone(1000)).toBe("caution");
    expect(densityAltitudeTone(2499)).toBe("caution");
  });

  it("classifies high density altitude as risk", () => {
    expect(densityAltitudeTone(2500)).toBe("risk");
    expect(densityAltitudeTone(5000)).toBe("risk");
  });
});

describe("metersToFeet", () => {
  it("converts standard altitudes to rounded feet", () => {
    expect(metersToFeet(0)).toBe(0);
    expect(metersToFeet(1000)).toBe(3281);
    expect(metersToFeet(-500)).toBe(-1640);
  });
});

describe("dewPointCelsius", () => {
  it("equals air temperature at 100% humidity", () => {
    expect(dewPointCelsius(20, 100)).toBeCloseTo(20, 1);
    expect(dewPointCelsius(0, 100)).toBeCloseTo(0, 1);
  });

  it("decreases as humidity decreases", () => {
    const high = dewPointCelsius(20, 80);
    const low = dewPointCelsius(20, 30);
    expect(high).toBeGreaterThan(low);
  });

  it("matches expected dew point for typical conditions", () => {
    // 25°C and 50% RH -> ~13.8°C dew point (Magnus formula)
    expect(dewPointCelsius(25, 50)).toBeCloseTo(13.8, 0);
  });

  it("yields a dew point lower than air temperature when RH < 100", () => {
    for (const rh of [10, 30, 50, 70, 90]) {
      const dp = dewPointCelsius(15, rh);
      expect(dp).toBeLessThan(15);
    }
  });
});

describe("condensationRisk", () => {
  it("flags spread under 2°C as high risk", () => {
    expect(condensationRisk(0)).toBe("high");
    expect(condensationRisk(1.9)).toBe("high");
  });

  it("flags spread between 2 and 5°C as moderate risk", () => {
    expect(condensationRisk(2)).toBe("moderate");
    expect(condensationRisk(4.99)).toBe("moderate");
  });

  it("flags spread of 5°C or more as low risk", () => {
    expect(condensationRisk(5)).toBe("low");
    expect(condensationRisk(10)).toBe("low");
  });
});
