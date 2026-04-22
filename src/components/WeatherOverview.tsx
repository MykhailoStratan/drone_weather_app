import React, { Suspense, useMemo, useState, type ReactNode } from "react";
import { BatteryThermalPanel } from "./BatteryThermalPanel";
import { DewPointPanel } from "./DewPointPanel";
import { DensityAltitudePanel } from "./DensityAltitudePanel";
import { FlightReadinessPanel } from "./FlightReadinessPanel";
import { getHourScrubberBoundary, HourScrubber } from "./FlightWindowBar";
import { IconCloud, IconEye, IconGauge, IconRain, IconSunrise, IconSunset } from "./Icons";
import type { AppTab } from "./TabBar";
import type { Preferences } from "../hooks/usePreferences";
import { formatDayLabel, formatTime, temperatureDisplay, visibilityDisplay, weatherLabel, windDirectionLabel, windSpeedDisplay } from "../lib/format";
import type { HourlyChartSeries } from "../lib/chartUtils";
import type { DailyWeather, WeatherPayload, WeatherSnapshot } from "../types";

const CloudVisibilityChart = React.lazy(() =>
  import("./WeatherCharts").then((m) => ({ default: m.CloudVisibilityChart })));
const PrecipitationOverlayChart = React.lazy(() =>
  import("./WeatherCharts").then((m) => ({ default: m.PrecipitationOverlayChart })));
const TemperatureCurveChart = React.lazy(() =>
  import("./WeatherCharts").then((m) => ({ default: m.TemperatureCurveChart })));

type WeatherOverviewProps = {
  activeHourIndex: number;
  activeTab?: AppTab;
  centerTimelineOnCurrentTime: boolean;
  currentDay: DailyWeather;
  currentSnapshot: WeatherSnapshot;
  hourlyForDay: WeatherSnapshot[];
  hourlyTemperature: Array<{ value: number }>;
  hourlyTimelineSeries: HourlyChartSeries;
  nextDayHourly: WeatherSnapshot[];
  onDateChange: (date: string) => void;
  onHourChange: (index: number) => void;
  onNextDayHourChange: (index: number) => void;
  onPrevDayHourChange: (index: number) => void;
  preferences: Preferences;
  prevDayHourly: WeatherSnapshot[];
  selectedDate: string;
  selectableDateMax: string;
  selectableDateMin: string;
  temperatureUnitLabel: string;
  visibilityUnitLabel: string;
  weather: WeatherPayload;
  weatherIcon: ReactNode;
  windUnitLabel: string;
};

export function WeatherOverview({
  activeHourIndex,
  activeTab = "now",
  centerTimelineOnCurrentTime,
  currentDay,
  currentSnapshot,
  hourlyForDay,
  hourlyTemperature,
  hourlyTimelineSeries,
  nextDayHourly,
  onDateChange,
  onHourChange,
  onNextDayHourChange,
  onPrevDayHourChange,
  preferences,
  prevDayHourly,
  selectedDate,
  selectableDateMax,
  selectableDateMin,
  temperatureUnitLabel,
  visibilityUnitLabel,
  weather,
  weatherIcon,
  windUnitLabel,
}: WeatherOverviewProps) {
  const solarBoundary = getHourScrubberBoundary({
    hourlyForDay,
    nextDayHourly,
    prevDayHourly,
    centerOnCurrentTime: centerTimelineOnCurrentTime,
  });
  const [calendarOpen, setCalendarOpen] = useState(false);
  const calendarDays = useMemo(
    () =>
      weather.daily.filter(
        (day) =>
          (!selectableDateMin || day.date >= selectableDateMin) &&
          (!selectableDateMax || day.date <= selectableDateMax),
      ),
    [selectableDateMax, selectableDateMin, weather.daily],
  );
  const todayDate = weather.current.time.slice(0, 10);
  const showPrimaryPanel = activeTab === "now";
  const showSupportPanel = activeTab === "drone";

  if (!showPrimaryPanel && !showSupportPanel) {
    return null;
  }

  return (
    <section className={`overview-grid premium-grid primary-priority tab-${activeTab}`}>
      {showPrimaryPanel && (
      <article className="primary-panel hero-conditions">
        <div className="hero-topline">
          <div className="hero-heading">
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
          <div className="summary-date-picker">
            <button
              type="button"
              className="summary-badge summary-date-trigger"
              aria-label="Choose forecast date"
              aria-expanded={calendarOpen}
              onClick={() => setCalendarOpen((open) => !open)}
            >
              <span>{formatDayLabel(currentDay.date)}</span>
              <svg
                className="summary-date-caret"
                width="10"
                height="10"
                viewBox="0 0 10 10"
                aria-hidden="true"
              >
                <path d="M2 3.5 L5 6.5 L8 3.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {calendarOpen && (
              <div className="date-popover" role="dialog" aria-label="Forecast dates">
                <div className="date-popover-grid">
                  {calendarDays.map((day) => {
                    const phase = day.date === todayDate ? "Today" : day.date < todayDate ? "History" : "Forecast";
                    const dayClassName = [
                      "date-popover-day",
                      day.date === selectedDate ? "active" : "",
                      day.date === todayDate ? "today" : "",
                    ].filter(Boolean).join(" ");

                    return (
                      <button
                        key={day.date}
                        type="button"
                        className={dayClassName}
                        onClick={() => {
                          onDateChange(day.date);
                          setCalendarOpen(false);
                        }}
                      >
                        <span>{phase}</span>
                        <strong>{formatDayLabel(day.date)}</strong>
                        <small>{weatherLabel(day.weatherCode)}</small>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
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
              centerOnCurrentTime={centerTimelineOnCurrentTime}
              onHourChange={onHourChange}
              onNextDayHourChange={onNextDayHourChange}
              onPrevDayHourChange={onPrevDayHourChange}
            />
            <CompactSolarWindow
              sunrise={currentDay.sunrise}
              sunset={currentDay.sunset}
              hourCycle={preferences.hourCycle}
              leftTime={solarBoundary.leftTime}
              rightTime={solarBoundary.rightTime}
            />
            <Suspense fallback={<div className="compact-timeline-charts-loading" />}>
              <div className="compact-timeline-charts">
                <TemperatureCurveChart
                  activeTime={currentSnapshot.time}
                  compact
                  points={hourlyTimelineSeries.temperature}
                  units={temperatureUnitLabel}
                />
                <PrecipitationOverlayChart
                  activeTime={currentSnapshot.time}
                  compact
                  points={hourlyTimelineSeries.precipitation}
                />
                <CloudVisibilityChart
                  activeTime={currentSnapshot.time}
                  compact
                  points={hourlyTimelineSeries.cloudVisibility}
                  visibilityUnits={visibilityUnitLabel}
                />
              </div>
            </Suspense>
          </div>

          <div className="hero-side-stack">
            <div className="wind-readiness-card">
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

              <div className="wind-readiness-divider" aria-hidden="true" />

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

            <div className={`wind-compact-row${currentSnapshot.windSpeed80m === undefined ? " no-aloft" : ""}`}>
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

              <div className="hero-mini-grid wind-detail-grid">
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
            </div>
          </div>
        </div>
      </article>
      )}

      {showSupportPanel && (
      <article className="stat-panel support-panel">
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
      )}
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

function CompactSolarWindow({
  sunrise,
  sunset,
  hourCycle,
  leftTime,
  rightTime,
}: {
  sunrise: string;
  sunset: string;
  hourCycle: "12h" | "24h";
  leftTime: string | null;
  rightTime: string | null;
}) {
  const rangeStartMs = leftTime ? new Date(leftTime).getTime() : new Date(`${currentDate(sunrise)}T00:00:00`).getTime();
  const rangeEndMs = rightTime ? new Date(rightTime).getTime() : rangeStartMs + 24 * 60 * 60 * 1000;
  const rangeMs = Math.max(1, rangeEndMs - rangeStartMs);
  const sunrisePct = percentInRange(new Date(sunrise).getTime(), rangeStartMs, rangeMs);
  const sunsetPct = percentInRange(new Date(sunset).getTime(), rangeStartMs, rangeMs);
  const daylightLeftPct = Math.max(0, Math.min(sunrisePct, sunsetPct));
  const daylightRightPct = Math.min(100, Math.max(sunrisePct, sunsetPct));

  return (
    <div className="compact-solar-window" aria-label="Solar window">
      <div className="compact-solar-header">
        <span className="section-label">Solar window</span>
        <strong>
          {formatTime(sunrise, hourCycle)} - {formatTime(sunset, hourCycle)}
        </strong>
      </div>
      <div className="compact-solar-track" aria-hidden="true">
        <span
          className="compact-solar-daylight"
          style={{
            left: `${daylightLeftPct}%`,
            width: `${Math.max(2, daylightRightPct - daylightLeftPct)}%`,
          }}
        />
        <span className="compact-solar-marker sunrise" style={{ left: `${sunrisePct}%` }} />
        <span className="compact-solar-marker sunset" style={{ left: `${sunsetPct}%` }} />
      </div>
      <div className="compact-solar-labels">
        <span>{leftTime ? formatTime(leftTime, hourCycle) : "Start"}</span>
        <span>Sunrise</span>
        <span>Sunset</span>
        <span>{rightTime ? formatTime(rightTime, hourCycle) : "End"}</span>
      </div>
    </div>
  );
}

function currentDate(value: string) {
  return value.slice(0, 10);
}

function percentInRange(valueMs: number, rangeStartMs: number, rangeMs: number) {
  return Math.max(0, Math.min(100, ((valueMs - rangeStartMs) / rangeMs) * 100));
}
