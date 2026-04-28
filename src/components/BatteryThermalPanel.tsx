import { estimateBattery } from "../lib/drone-calculations";

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
