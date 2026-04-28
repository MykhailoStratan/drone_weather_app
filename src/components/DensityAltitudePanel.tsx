import {
  computeDensityAltitude,
  densityAltitudeTone,
  metersToFeet,
  type DensityAltitudeTone,
} from "../lib/drone-calculations";

const TONE_ADVICE: Record<DensityAltitudeTone, string> = {
  good: "Air density near sea-level standard — full lift available.",
  caution: "Reduced air density. Expect shorter hover times and lower payload.",
  risk: "Significantly thin air. Rotors work harder — battery drains faster.",
};

export function DensityAltitudePanel({
  temperatureCelsius,
  pressureHPa,
}: {
  temperatureCelsius: number;
  pressureHPa: number;
}) {
  const { pressureAltM, densityAltM, isaDeviationC, liftPenaltyPct } =
    computeDensityAltitude(temperatureCelsius, pressureHPa);

  const t = densityAltitudeTone(densityAltM);

  return (
    <div className="density-alt-card">
      <div className="density-alt-header">
        <p className="section-label">Density Altitude</p>
        <span className={`density-alt-badge ${t}`}>
          {densityAltM >= 0 ? "+" : ""}{Math.round(densityAltM)} m
        </span>
      </div>

      <div className="density-alt-stats">
        <div className="density-alt-stat">
          <span>Pressure alt</span>
          <strong>{Math.round(pressureAltM)} m</strong>
          <small>{metersToFeet(pressureAltM)} ft</small>
        </div>
        <div className="density-alt-stat">
          <span>Density alt</span>
          <strong className={t}>{Math.round(densityAltM)} m</strong>
          <small>{metersToFeet(densityAltM)} ft</small>
        </div>
        <div className="density-alt-stat">
          <span>ISA deviation</span>
          <strong className={isaDeviationC > 0 ? "caution" : "good"}>
            {isaDeviationC >= 0 ? "+" : ""}{isaDeviationC.toFixed(1)} °C
          </strong>
          <small>{pressureHPa} hPa</small>
        </div>
        <div className="density-alt-stat">
          <span>Lift penalty</span>
          <strong className={t}>{liftPenaltyPct}%</strong>
          <small>vs sea-level</small>
        </div>
      </div>

      <p className="density-alt-advice">{TONE_ADVICE[t]}</p>
    </div>
  );
}
