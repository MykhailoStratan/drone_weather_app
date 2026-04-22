type DaTone = "good" | "caution" | "risk";

function computeDensityAltitude(tempC: number, pressureHPa: number): {
  pressureAltM: number;
  densityAltM: number;
  isaDeviationC: number;
  liftPenaltyPct: number;
} {
  const SEA_LEVEL_PRESSURE = 1013.25;
  const pressureAltM = (1 - Math.pow(pressureHPa / SEA_LEVEL_PRESSURE, 0.190284)) * 44330.76;
  const isaAtPaC = 15 - 0.0065 * pressureAltM;
  const isaDeviationC = tempC - isaAtPaC;
  const densityAltM = pressureAltM + isaDeviationC / 0.00649;
  const liftPenaltyPct = Math.max(0, Math.round((densityAltM / 12192) * 100));
  return { pressureAltM, densityAltM, isaDeviationC, liftPenaltyPct };
}

function daToFeet(meters: number): number {
  return Math.round(meters * 3.28084);
}

function tone(densityAltM: number): DaTone {
  if (densityAltM < 1000) return "good";
  if (densityAltM < 2500) return "caution";
  return "risk";
}

const TONE_ADVICE: Record<DaTone, string> = {
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

  const t = tone(densityAltM);

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
          <small>{daToFeet(pressureAltM)} ft</small>
        </div>
        <div className="density-alt-stat">
          <span>Density alt</span>
          <strong className={t}>{Math.round(densityAltM)} m</strong>
          <small>{daToFeet(densityAltM)} ft</small>
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
