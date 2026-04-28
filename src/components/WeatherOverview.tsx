import React, { Suspense, useMemo, useState, type ReactNode } from "react";
import { BatteryThermalPanel } from "./BatteryThermalPanel";
import { DewPointPanel } from "./DewPointPanel";
import { DensityAltitudePanel } from "./DensityAltitudePanel";
import { FlightReadinessPanel } from "./FlightReadinessPanel";
import { getHourRiskDetails, getHourScrubberBoundary, HourScrubber, type HourRiskReason } from "./FlightWindowBar";
import { IconCloud, IconEye, IconGauge, IconRain, IconSunrise, IconSunset, IconThermometer } from "./Icons";
import type { AppTab } from "./TabBar";
import type { Preferences } from "../hooks/usePreferences";
import type { WeatherDetailStatus } from "../hooks/useWeatherData";
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
  detailsLoading: boolean;
  detailsStatus: WeatherDetailStatus;
  hourlyForDay: WeatherSnapshot[];
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
  weather: WeatherPayload;
  weatherIcon: ReactNode;
};

type CompactTimelineChartKey = "temperature" | "precipitation" | "skyClarity";

const compactTimelineChartOptions: Array<{
  key: CompactTimelineChartKey;
  label: string;
  ariaLabel: string;
  icon: ReactNode;
}> = [
  {
    key: "temperature",
    label: "Temp",
    ariaLabel: "Toggle temperature distribution chart",
    icon: <IconThermometer />,
  },
  {
    key: "precipitation",
    label: "Precip",
    ariaLabel: "Toggle precipitation chart",
    icon: <IconRain />,
  },
  {
    key: "skyClarity",
    label: "Sky",
    ariaLabel: "Toggle sky clarity chart",
    icon: <IconCloud />,
  },
];

export function WeatherOverview({
  activeHourIndex,
  activeTab = "now",
  centerTimelineOnCurrentTime,
  currentDay,
  currentSnapshot,
  detailsLoading,
  detailsStatus,
  hourlyForDay,
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
  weather,
  weatherIcon,
}: WeatherOverviewProps) {
  const temperatureUnitLabel = preferences.temperatureUnit === "f" ? "F" : "C";
  const windUnitLabel = preferences.windUnit === "mph" ? "mph" : "km/h";
  const visibilityUnitLabel = preferences.visibilityUnit === "mi" ? "mi" : "km";
  const solarBoundary = getHourScrubberBoundary({
    hourlyForDay,
    nextDayHourly,
    prevDayHourly,
    centerOnCurrentTime: centerTimelineOnCurrentTime,
  });
  const selectedHourRisk = getHourRiskDetails(currentSnapshot);
  const selectedHourRiskTone = selectedHourRisk.tone !== "good" ? selectedHourRisk.tone : null;
  const [dismissedRiskTime, setDismissedRiskTime] = useState<string | null>(null);
  const showHourRiskWindow =
    selectedHourRiskTone !== null && hourlyForDay.length > 0 && dismissedRiskTime !== currentSnapshot.time;
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [visibleCompactCharts, setVisibleCompactCharts] = useState<Record<CompactTimelineChartKey, boolean>>({
    temperature: true,
    precipitation: true,
    skyClarity: true,
  });
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

  function handleHourChange(index: number) {
    setDismissedRiskTime(null);
    onHourChange(index);
  }

  function handleNextDayHourChange(index: number) {
    setDismissedRiskTime(null);
    onNextDayHourChange(index);
  }

  function handlePrevDayHourChange(index: number) {
    setDismissedRiskTime(null);
    onPrevDayHourChange(index);
  }

  function toggleCompactChart(chart: CompactTimelineChartKey) {
    setVisibleCompactCharts((current) => ({
      ...current,
      [chart]: !current[chart],
    }));
  }

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
            <div className={`temperature-summary-row${selectedHourRisk.tone !== "good" ? " has-risk" : ""}`}>
              <div className="temperature-readout">
                <div className="temperature-main">
                  <span className="temperature-value">
                    {temperatureDisplay(currentSnapshot.temperature, preferences.temperatureUnit)}
                  </span>
                  <span className="temperature-unit">°{temperatureUnitLabel}</span>
                </div>
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
            </div>
            <CompactTimelineChartControls
              visibleCharts={visibleCompactCharts}
              onToggle={toggleCompactChart}
            />
            <div className="hour-scrubber-risk-anchor">
              <HourScrubber
                hourlyForDay={hourlyForDay}
                nextDayHourly={nextDayHourly}
                prevDayHourly={prevDayHourly}
                hourCycle={preferences.hourCycle}
                activeHourIndex={activeHourIndex}
                centerOnCurrentTime={centerTimelineOnCurrentTime}
                onHourChange={handleHourChange}
                onNextDayHourChange={handleNextDayHourChange}
                onPrevDayHourChange={handlePrevDayHourChange}
              />
              {showHourRiskWindow && (
                <HourRiskInfoWindow
                  hourLabel={formatTime(currentSnapshot.time, preferences.hourCycle)}
                  onDismiss={() => setDismissedRiskTime(currentSnapshot.time)}
                  reasons={selectedHourRisk.riskReasons}
                  tone={selectedHourRiskTone}
                />
              )}
            </div>
            <CompactSolarWindow
              sunrise={currentDay.sunrise}
              sunset={currentDay.sunset}
              hourCycle={preferences.hourCycle}
              leftTime={solarBoundary.leftTime}
              rightTime={solarBoundary.rightTime}
            />
            <PartialForecastStatus
              detailsLoading={detailsLoading}
              detailsStatus={detailsStatus}
            />
            {(visibleCompactCharts.temperature || visibleCompactCharts.precipitation || visibleCompactCharts.skyClarity) && (
              <Suspense fallback={<div className="compact-timeline-charts-loading" />}>
                <div className="compact-timeline-charts">
                  {visibleCompactCharts.temperature && (
                    <TemperatureCurveChart
                      activeTime={currentSnapshot.time}
                      compact
                      points={hourlyTimelineSeries.temperature}
                      units={temperatureUnitLabel}
                    />
                  )}
                  {visibleCompactCharts.precipitation && (
                    <PrecipitationOverlayChart
                      activeTime={currentSnapshot.time}
                      compact
                      points={hourlyTimelineSeries.precipitation}
                    />
                  )}
                  {visibleCompactCharts.skyClarity && (
                    <CloudVisibilityChart
                      activeTime={currentSnapshot.time}
                      compact
                      points={hourlyTimelineSeries.cloudVisibility}
                      visibilityUnits={visibilityUnitLabel}
                    />
                  )}
                </div>
              </Suspense>
            )}
          </div>

          <div className="hero-side-stack">
            <div className="wind-readiness-card">
              <div className="wind-spotlight">
                <p className="section-label">Wind Direction</p>
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
                  <p className="section-label">Wind Aloft</p>
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

function CompactTimelineChartControls({
  visibleCharts,
  onToggle,
}: {
  visibleCharts: Record<CompactTimelineChartKey, boolean>;
  onToggle: (chart: CompactTimelineChartKey) => void;
}) {
  return (
    <div className="timeline-chart-controls" aria-label="Timeline chart toggles">
      {compactTimelineChartOptions.map((option) => (
        <button
          key={option.key}
          type="button"
          className={visibleCharts[option.key] ? "timeline-chart-toggle-button active" : "timeline-chart-toggle-button"}
          aria-label={option.ariaLabel}
          aria-pressed={visibleCharts[option.key]}
          onClick={() => onToggle(option.key)}
        >
          <span className="timeline-chart-toggle-icon" aria-hidden="true">
            {option.icon}
          </span>
          <span>{option.label}</span>
        </button>
      ))}
    </div>
  );
}

function HourRiskInfoWindow({
  hourLabel,
  onDismiss,
  reasons,
  tone,
}: {
  hourLabel: string;
  onDismiss: () => void;
  reasons: HourRiskReason[];
  tone: "caution" | "risk";
}) {
  const toneLabel = tone === "risk" ? "Caution" : "Moderate";

  return (
    <aside className={`hour-risk-window ${tone}`} aria-live="polite" aria-label={`${toneLabel} hourly condition reasons`}>
      <div className="hour-risk-window-header">
        <div>
          <span>{hourLabel}</span>
          <strong>{toneLabel}</strong>
        </div>
        <button
          type="button"
          className="hour-risk-close-button"
          aria-label="Dismiss hourly condition reasons"
          onClick={onDismiss}
        >
          X
        </button>
      </div>
      <ul className="hour-risk-list">
        {reasons.map((reason) => (
          <li key={`${reason.metric}-${reason.threshold}`}>
            <span className={`hour-risk-dot ${reason.tone}`} aria-hidden="true" />
            <div>
              <strong>{reason.metric}</strong>
              <span>{reason.value} - {reason.threshold}</span>
            </div>
          </li>
        ))}
      </ul>
    </aside>
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
  const shear = gusts !== undefined && speed > 0 ? Math.round(((gusts - speed) / speed) * 100) : 0;
  const shearTone = shear > 40 ? "risk" : shear > 20 ? "caution" : "good";
  const directionLabel = direction !== undefined ? windDirectionLabel(direction) : "Variable";
  return (
    <div className="wind-aloft-level">
      <span className="wind-aloft-alt">{label}</span>
      <span
        className="wind-aloft-vector"
        style={direction !== undefined ? { transform: `rotate(${direction}deg)` } : undefined}
        aria-hidden="true"
      />
      <span className="wind-aloft-reading">
        <span className="wind-aloft-speed">{windSpeedDisplay(speed, unit)} {unitLabel}</span>
        <span className="wind-aloft-dir">{directionLabel}</span>
        {gusts !== undefined && (
          <span className={`wind-aloft-gusts ${shearTone}`}>Gust {windSpeedDisplay(gusts, unit)}</span>
        )}
      </span>
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

function PartialForecastStatus({
  detailsLoading,
  detailsStatus,
}: {
  detailsLoading: boolean;
  detailsStatus: WeatherDetailStatus;
}) {
  const messages = [
    detailsStatus.timeline === "error"
      ? (detailsStatus.timelineMessage ?? "Weather timeline is unavailable right now.")
      : null,
    detailsStatus.alerts === "error"
      ? (detailsStatus.alertsMessage ?? "Weather alerts are unavailable right now.")
      : null,
  ].filter((message): message is string => Boolean(message));

  if (!detailsLoading && messages.length === 0) {
    return null;
  }

  return (
    <div className={messages.length > 0 ? "partial-forecast-status warning" : "partial-forecast-status"} role="status">
      {messages.length > 0 ? (
        messages.map((message) => <span key={message}>{message}</span>)
      ) : (
        <span>Checking hourly forecast and alerts...</span>
      )}
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

  const sunriseMs = new Date(sunrise).getTime();
  const sunsetMs = new Date(sunset).getTime();
  const sunriseInRange = sunriseMs >= rangeStartMs && sunriseMs <= rangeEndMs;
  const sunsetInRange = sunsetMs >= rangeStartMs && sunsetMs <= rangeEndMs;

  const sunrisePct = percentInRange(sunriseMs, rangeStartMs, rangeMs);
  const sunsetPct = percentInRange(sunsetMs, rangeStartMs, rangeMs);
  const daylightLeftPct = Math.max(0, Math.min(sunrisePct, sunsetPct));
  const daylightRightPct = Math.min(100, Math.max(sunrisePct, sunsetPct));
  const sunriseLabelPct = clampSolarLabelPct(sunrisePct);
  const sunsetLabelPct = clampSolarLabelPct(sunsetPct);

  const hasInRangeLabels = sunriseInRange || sunsetInRange;
  const outOfRangeItems: { key: string; label: string; time: string }[] = [];
  if (!sunriseInRange) outOfRangeItems.push({ key: "sunrise", label: "Sunrise", time: formatTime(sunrise, hourCycle) });
  if (!sunsetInRange) outOfRangeItems.push({ key: "sunset", label: "Sunset", time: formatTime(sunset, hourCycle) });

  return (
    <div className="compact-solar-window" aria-label="Solar window">
      <div className="compact-solar-header">
        <span className="section-label">Solar Window</span>
        {outOfRangeItems.length > 0 && (
          <div className="compact-solar-out-of-range">
            {outOfRangeItems.map(({ key, label, time }) => (
              <span key={key}>{label} {time}</span>
            ))}
            <span className="compact-solar-out-of-range-note">outside this window</span>
          </div>
        )}
      </div>
      <div className="compact-solar-track" aria-hidden="true">
        <span
          className="compact-solar-daylight"
          style={{
            left: `${daylightLeftPct}%`,
            width: `${Math.max(2, daylightRightPct - daylightLeftPct)}%`,
          }}
        />
        {sunriseInRange && <span className="compact-solar-marker sunrise" style={{ left: `${sunrisePct}%` }} />}
        {sunsetInRange && <span className="compact-solar-marker sunset" style={{ left: `${sunsetPct}%` }} />}
      </div>
      {hasInRangeLabels && (
        <div className="compact-solar-labels">
          {sunriseInRange && (
            <span className="compact-solar-label sunrise" style={{ left: `${sunriseLabelPct}%` }}>
              <strong>{formatTime(sunrise, hourCycle)}</strong>
              <span>Sunrise</span>
            </span>
          )}
          {sunsetInRange && (
            <span className="compact-solar-label sunset" style={{ left: `${sunsetLabelPct}%` }}>
              <strong>{formatTime(sunset, hourCycle)}</strong>
              <span>Sunset</span>
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function currentDate(value: string) {
  return value.slice(0, 10);
}

function percentInRange(valueMs: number, rangeStartMs: number, rangeMs: number) {
  return Math.max(0, Math.min(100, ((valueMs - rangeStartMs) / rangeMs) * 100));
}

function clampSolarLabelPct(value: number) {
  return Math.max(8, Math.min(92, value));
}
