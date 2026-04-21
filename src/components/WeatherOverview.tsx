import type { ReactNode } from "react";
import { BatteryThermalPanel } from "./BatteryThermalPanel";
import { DewPointPanel } from "./DewPointPanel";
import { DensityAltitudePanel } from "./DensityAltitudePanel";
import { FlightReadinessPanel } from "./FlightReadinessPanel";
import { HourScrubber } from "./FlightWindowBar";
import { IconCloud, IconEye, IconGauge, IconRain, IconSunrise, IconSunset } from "./Icons";
import type { Preferences } from "../hooks/usePreferences";
import { formatDayLabel, formatTime, temperatureDisplay, visibilityDisplay, weatherLabel, windDirectionLabel, windSpeedDisplay } from "../lib/format";
import type { DailyWeather, WeatherPayload, WeatherSnapshot } from "../types";

type WeatherOverviewProps = {
  activeHourIndex: number;
  currentDay: DailyWeather;
  currentSnapshot: WeatherSnapshot;
  hourlyForDay: WeatherSnapshot[];
  hourlyTemperature: Array<{ value: number }>;
  nextDayHourly: WeatherSnapshot[];
  onHourChange: (index: number) => void;
  onNextDayHourChange: (index: number) => void;
  onPrevDayHourChange: (index: number) => void;
  preferences: Preferences;
  prevDayHourly: WeatherSnapshot[];
  temperatureUnitLabel: string;
  visibilityUnitLabel: string;
  weather: WeatherPayload;
  weatherIcon: ReactNode;
  windUnitLabel: string;
};

export function WeatherOverview({
  activeHourIndex,
  currentDay,
  currentSnapshot,
  hourlyForDay,
  hourlyTemperature,
  nextDayHourly,
  onHourChange,
  onNextDayHourChange,
  onPrevDayHourChange,
  preferences,
  prevDayHourly,
  temperatureUnitLabel,
  visibilityUnitLabel,
  weather,
  weatherIcon,
  windUnitLabel,
}: WeatherOverviewProps) {
  return (
    <section className="overview-grid premium-grid primary-priority">
      <article className="primary-panel hero-conditions">
        <div className="hero-topline">
          <div className="hero-heading">
            <p className="section-label">{weather.locationLabel}</p>
            <div className="hero-condition-row">
              <span className="hero-condition-icon">{weatherIcon}</span>
              <div>
                <h2>{weatherLabel(currentSnapshot.weatherCode)}</h2>
                <p className="hero-supporting-copy">
                  Updated for {formatDayLabel(currentDay.date)} - {weather.timezone}
                </p>
              </div>
            </div>
          </div>
          <span className="summary-badge">{formatDayLabel(currentDay.date)}</span>
        </div>

        <div className="hero-stats">
          <div className="temperature-block">
            <div className="temperature-main">
              <span className="temperature-value">
                {temperatureDisplay(currentSnapshot.temperature, preferences.temperatureUnit)}
              </span>
              <span className="temperature-unit">°{temperatureUnitLabel}</span>
            </div>
            <div className="hero-pill-row">
              <span className="hero-pill">
                H {temperatureDisplay(currentDay.temperatureMax, preferences.temperatureUnit)}° - L{" "}
                {temperatureDisplay(currentDay.temperatureMin, preferences.temperatureUnit)}°
              </span>
              <span className="hero-pill">
                Rain {Math.round(currentSnapshot.precipitationProbability)}%
              </span>
            </div>
            <HourScrubber
              hourlyForDay={hourlyForDay}
              nextDayHourly={nextDayHourly}
              prevDayHourly={prevDayHourly}
              hourCycle={preferences.hourCycle}
              activeHourIndex={activeHourIndex}
              onHourChange={onHourChange}
              onNextDayHourChange={onNextDayHourChange}
              onPrevDayHourChange={onPrevDayHourChange}
            />
          </div>

          <div className="wind-spotlight">
            <p className="section-label">Wind direction</p>
            <div className="wind-visual">
              <div className="wind-arrow-ring">
                <span
                  className="wind-arrow"
                  style={{ transform: `rotate(${currentSnapshot.windDirection}deg)` }}
                  aria-hidden="true"
                />
              </div>
              <div className="wind-copy">
                <strong>
                  {windDirectionLabel(currentSnapshot.windDirection)} - {Math.round(currentSnapshot.windDirection)}°
                </strong>
                <p>
                  {windSpeedDisplay(currentSnapshot.windSpeed, preferences.windUnit)} {windUnitLabel} sustained
                  <br />
                  gusts to {windSpeedDisplay(currentSnapshot.windGusts, preferences.windUnit)} {windUnitLabel}
                </p>
              </div>
            </div>
          </div>

          {currentSnapshot.windSpeed80m !== undefined && (
            <div className="wind-aloft-card">
              <p className="section-label">Wind aloft</p>
              <div className="wind-aloft-levels">
                <WindAloftLevel
                  label="10 m"
                  speed={currentSnapshot.windSpeed}
                  gusts={currentSnapshot.windGusts}
                  direction={currentSnapshot.windDirection}
                  unit={preferences.windUnit}
                  unitLabel={windUnitLabel}
                />
                <WindAloftLevel
                  label="80 m"
                  speed={currentSnapshot.windSpeed80m}
                  gusts={currentSnapshot.windGusts80m}
                  direction={currentSnapshot.windDirection80m}
                  unit={preferences.windUnit}
                  unitLabel={windUnitLabel}
                />
                <WindAloftLevel
                  label="120 m"
                  speed={currentSnapshot.windSpeed120m}
                  gusts={currentSnapshot.windGusts120m}
                  direction={currentSnapshot.windDirection120m}
                  unit={preferences.windUnit}
                  unitLabel={windUnitLabel}
                />
              </div>
            </div>
          )}
        </div>

        <div className="hero-mini-grid">
          <Metric icon={<IconSunrise />} label="Sunrise" value={formatTime(currentDay.sunrise, preferences.hourCycle)} />
          <Metric icon={<IconSunset />} label="Sunset" value={formatTime(currentDay.sunset, preferences.hourCycle)} />
          <Metric icon={<IconRain />} label="Rain chance" value={`${Math.round(currentSnapshot.precipitationProbability)}%`} />
          <Metric icon={<IconCloud />} label="Cloud cover" value={`${Math.round(currentSnapshot.cloudCover)}%`} />
          <Metric
            icon={<IconEye />}
            label="Visibility"
            value={`${visibilityDisplay(currentSnapshot.visibility / 1000, preferences.visibilityUnit)} ${visibilityUnitLabel}`}
          />
          <Metric icon={<IconGauge />} label="Pressure" value={`${Math.round(currentSnapshot.pressure)} hPa`} />
        </div>
      </article>

      <article className="stat-panel support-panel">
        <div className="support-panel-section">
          <p className="section-label">Flight readiness</p>
          <FlightReadinessPanel
            currentDay={currentDay}
            currentSnapshot={currentSnapshot}
            temperatureUnit={preferences.temperatureUnit}
            windUnit={preferences.windUnit}
            windUnitLabel={windUnitLabel}
            visibilityUnit={preferences.visibilityUnit}
            visibilityUnitLabel={visibilityUnitLabel}
          />
        </div>

        <div className="support-panel-grid">
          <section className="support-panel-section">
            <div className="support-panel-header">
              <p className="section-label">Today summary</p>
              <h3>{formatDayLabel(currentDay.date)}</h3>
            </div>
            <div className="compact-info-grid">
              <div className="range-summary compact-summary">
                <div className="range-header">
                  <span>Hourly swing</span>
                  <strong>
                    {Math.round(Math.min(...hourlyTemperature.map((point) => point.value), 0))}° -{" "}
                    {Math.round(Math.max(...hourlyTemperature.map((point) => point.value), 0))}°
                  </strong>
                </div>
                <p className="muted">
                  {Math.round(currentDay.precipitationSum)} mm across {Math.round(currentDay.precipitationHours)} hours.
                </p>
              </div>
              <div className="range-summary compact-summary">
                <div className="range-header">
                  <span>Wind ceiling</span>
                  <strong>
                    {windSpeedDisplay(currentDay.windSpeedMax, preferences.windUnit)} {windUnitLabel}
                  </strong>
                </div>
                <p className="muted">
                  Gusts up to {windSpeedDisplay(currentDay.windGustsMax, preferences.windUnit)} {windUnitLabel}.
                </p>
              </div>
              <div className="range-summary compact-summary">
                <div className="range-header">
                  <span>Visibility / cover</span>
                  <strong>
                    {visibilityDisplay(currentSnapshot.visibility / 1000, preferences.visibilityUnit)} {visibilityUnitLabel}
                  </strong>
                </div>
                <div className="progress-meter" aria-hidden="true">
                  <span style={{ width: `${Math.min(100, Math.max(8, currentSnapshot.cloudCover))}%` }} />
                </div>
                <p className="muted">{Math.round(currentSnapshot.cloudCover)}% cloud cover.</p>
              </div>
            </div>
          </section>

          <section className="support-panel-section">
            <div className="support-panel-header">
              <p className="section-label">Status</p>
              <h3>At a glance</h3>
            </div>
            <div className="compact-info-grid">
              <div className="status-card compact-summary">
                <span>Alerts</span>
                <strong>{weather.alerts.length}</strong>
                <p>
                  {weather.alerts.length > 0 ? "Warnings listed below." : "No severe alerts right now."}
                </p>
              </div>
              <div className="status-card compact-summary">
                <span>Local time</span>
                <strong>{formatTime(currentSnapshot.time, preferences.hourCycle)}</strong>
                <p>Synced with {weather.timezone}.</p>
              </div>
              <div className="range-summary compact-summary">
                <div className="range-header">
                  <span>Pressure</span>
                  <strong>{Math.round(currentSnapshot.pressure)} hPa</strong>
                </div>
                <p className="muted">Surface pressure from the live reading.</p>
              </div>
            </div>
          </section>
        </div>

        <div className="support-panel-section">
          <BatteryThermalPanel temperatureCelsius={currentSnapshot.temperature} />
        </div>

        {currentSnapshot.relativeHumidity !== undefined && (
          <div className="support-panel-section">
            <DewPointPanel
              temperatureCelsius={currentSnapshot.temperature}
              relativeHumidity={currentSnapshot.relativeHumidity}
              temperatureUnit={preferences.temperatureUnit}
            />
          </div>
        )}

        <div className="support-panel-section">
          <DensityAltitudePanel
            temperatureCelsius={currentSnapshot.temperature}
            pressureHPa={currentSnapshot.pressure}
          />
        </div>
      </article>
    </section>
  );
}

function WindAloftLevel({
  label,
  speed,
  gusts,
  direction,
  unit,
  unitLabel,
}: {
  label: string;
  speed: number | undefined;
  gusts: number | undefined;
  direction: number | undefined;
  unit: "kmh" | "mph";
  unitLabel: string;
}) {
  if (speed === undefined) return null;
  const hasAdditionalInfo = gusts !== undefined;
  const shear = gusts !== undefined && speed > 0 ? Math.round(((gusts - speed) / speed) * 100) : 0;
  const shearTone = shear > 40 ? "risk" : shear > 20 ? "caution" : "good";
  return (
    <div className="wind-aloft-level">
      <span className="wind-aloft-alt">{label}</span>
      <span className="wind-aloft-speed">{windSpeedDisplay(speed, unit)} {unitLabel}</span>
      {hasAdditionalInfo ? (
        <>
          {gusts !== undefined && (
            <span className={`wind-aloft-gusts ${shearTone}`}>↑{windSpeedDisplay(gusts, unit)}</span>
          )}
          {direction !== undefined && (
            <span className="wind-aloft-dir">{windDirectionLabel(direction)}</span>
          )}
        </>
      ) : null}
    </div>
  );
}

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="metric-card">
      <span className="metric-icon">{icon}</span>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
