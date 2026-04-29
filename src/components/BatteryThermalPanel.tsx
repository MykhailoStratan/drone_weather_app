import type { AircraftProfile } from "../lib/aircraftProfiles";
import { estimateBattery } from "../lib/drone-calculations";

export function BatteryThermalPanel({
  aircraftProfile,
  temperatureCelsius,
}: {
  aircraftProfile: AircraftProfile;
  temperatureCelsius: number;
}) {
  const estimate = estimateBattery(temperatureCelsius);
  const payloadPenalty = Math.min(18, Math.round(aircraftProfile.payloadGrams / 250));
  const batteryAgePenalty = aircraftProfile.batteryAge === "aged" ? 12 : aircraftProfile.batteryAge === "used" ? 5 : 0;
  const effectiveCapacity = Math.max(0, estimate.efficiencyPct - payloadPenalty - batteryAgePenalty);
  const profileTone =
    effectiveCapacity <= aircraftProfile.reserveBatteryPct
      ? "risk"
      : effectiveCapacity <= aircraftProfile.reserveBatteryPct + 15
        ? "caution"
        : estimate.tone;
  const barWidth = `${effectiveCapacity}%`;
  const tempDisplay = `${Math.round(temperatureCelsius)} C`;

  return (
    <div className="battery-thermal-card">
      <div className="battery-thermal-header">
        <p className="section-label">Battery Thermal Performance</p>
        <span className={`battery-thermal-badge ${profileTone}`}>
          {effectiveCapacity}% usable
        </span>
      </div>

      <div className="battery-thermal-bar-wrap">
        <div className="battery-thermal-bar" aria-label={`Battery usable capacity: ${effectiveCapacity}%`}>
          <div
            className={`battery-thermal-fill ${profileTone}`}
            style={{ width: barWidth }}
            role="progressbar"
            aria-valuenow={effectiveCapacity}
            aria-valuemin={0}
            aria-valuemax={100}
          />
        </div>
        <span className="battery-thermal-temp">{tempDisplay}</span>
      </div>

      <p className="battery-thermal-impact">{estimate.flightImpact}</p>
      <p className="battery-thermal-profile">
        {aircraftProfile.reserveBatteryPct}% reserve, {aircraftProfile.payloadGrams} g payload, {aircraftProfile.batteryAge} batteries
      </p>
      <p className="battery-thermal-advice">{estimate.advice}</p>
    </div>
  );
}
