type BatteryTone = "good" | "caution" | "risk";

type BatteryEstimate = {
  efficiencyPct: number;
  tone: BatteryTone;
  flightImpact: string;
  advice: string;
};

const BREAKPOINTS: [number, number][] = [
  [-20, 20],
  [-10, 38],
  [0,   58],
  [10,  78],
  [20,  94],
  [25,  100],
  [35,  97],
  [40,  88],
  [50,  70],
];

function interpolateBatteryEfficiency(tempC: number): number {
  if (tempC <= BREAKPOINTS[0][0]) return BREAKPOINTS[0][1];
  if (tempC >= BREAKPOINTS[BREAKPOINTS.length - 1][0]) return BREAKPOINTS[BREAKPOINTS.length - 1][1];

  for (let i = 0; i < BREAKPOINTS.length - 1; i++) {
    const [t0, e0] = BREAKPOINTS[i];
    const [t1, e1] = BREAKPOINTS[i + 1];
    if (tempC >= t0 && tempC <= t1) {
      const ratio = (tempC - t0) / (t1 - t0);
      return Math.round(e0 + ratio * (e1 - e0));
    }
  }
  return 100;
}

function estimateBattery(tempC: number): BatteryEstimate {
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

export function BatteryThermalPanel({ temperatureCelsius }: { temperatureCelsius: number }) {
  const estimate = estimateBattery(temperatureCelsius);
  const barWidth = `${estimate.efficiencyPct}%`;
  const tempDisplay = `${Math.round(temperatureCelsius)} °C`;

  return (
    <div className="battery-thermal-card">
      <div className="battery-thermal-header">
        <p className="section-label">Battery Thermal Performance</p>
        <span className={`battery-thermal-badge ${estimate.tone}`}>
          {estimate.efficiencyPct}% capacity
        </span>
      </div>

      <div className="battery-thermal-bar-wrap">
        <div className="battery-thermal-bar" aria-label={`Battery efficiency: ${estimate.efficiencyPct}%`}>
          <div
            className={`battery-thermal-fill ${estimate.tone}`}
            style={{ width: barWidth }}
            role="progressbar"
            aria-valuenow={estimate.efficiencyPct}
            aria-valuemin={0}
            aria-valuemax={100}
          />
        </div>
        <span className="battery-thermal-temp">{tempDisplay}</span>
      </div>

      <p className="battery-thermal-impact">{estimate.flightImpact}</p>
      <p className="battery-thermal-advice">{estimate.advice}</p>
    </div>
  );
}
