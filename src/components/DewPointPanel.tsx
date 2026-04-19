type CondensationRisk = "low" | "moderate" | "high";

function dewPointCelsius(tempC: number, relativeHumidity: number): number {
  const a = 17.625;
  const b = 243.04;
  const gamma = Math.log(relativeHumidity / 100) + (a * tempC) / (b + tempC);
  return (b * gamma) / (a - gamma);
}

function condensationRisk(spread: number): CondensationRisk {
  if (spread < 2) return "high";
  if (spread < 5) return "moderate";
  return "low";
}

const RISK_LABEL: Record<CondensationRisk, string> = {
  low: "Low risk",
  moderate: "Moderate risk",
  high: "High risk",
};

const RISK_ADVICE: Record<CondensationRisk, string> = {
  low: "Conditions are clear for cameras and electronics.",
  moderate: "Warm up equipment gradually before powering on.",
  high: "Condensation likely — delay flight or protect lens and motors.",
};

export function DewPointPanel({
  temperatureCelsius,
  relativeHumidity,
  temperatureUnit,
}: {
  temperatureCelsius: number;
  relativeHumidity: number;
  temperatureUnit: "c" | "f";
}) {
  const dewC = dewPointCelsius(temperatureCelsius, relativeHumidity);
  const spread = temperatureCelsius - dewC;
  const risk = condensationRisk(spread);

  const formatTemp = (c: number) =>
    temperatureUnit === "f"
      ? `${Math.round(c * 9 / 5 + 32)} °F`
      : `${Math.round(c)} °C`;

  return (
    <div className="dew-point-card">
      <div className="dew-point-header">
        <p className="section-label">Dew point · condensation</p>
        <span className={`dew-point-badge ${risk}`}>{RISK_LABEL[risk]}</span>
      </div>

      <div className="dew-point-stats">
        <div className="dew-point-stat">
          <span>Air temp</span>
          <strong>{formatTemp(temperatureCelsius)}</strong>
        </div>
        <div className="dew-point-stat">
          <span>Dew point</span>
          <strong>{formatTemp(dewC)}</strong>
        </div>
        <div className="dew-point-stat">
          <span>Humidity</span>
          <strong>{Math.round(relativeHumidity)}%</strong>
        </div>
        <div className="dew-point-stat">
          <span>Spread</span>
          <strong className={`dew-spread-value ${risk}`}>{spread.toFixed(1)} °C</strong>
        </div>
      </div>

      <p className="dew-point-advice">{RISK_ADVICE[risk]}</p>
    </div>
  );
}
