import React, { Suspense } from "react";
import { AirspacePanel } from "./AirspacePanel";
import type { Preferences } from "../hooks/usePreferences";
import { findNearestSnapshotIndex } from "../lib/app-utils";
import { formatDayLabel, formatHourLabel, temperatureDisplay, visibilityDisplay, weatherLabel, windDirectionLabel, windSpeedDisplay } from "../lib/format";
import type { AirspaceResponse, DailyWeather, WeatherPayload, WeatherSnapshot } from "../types";

const AlertTimelineChart = React.lazy(() =>
  import("./WeatherCharts").then((m) => ({ default: m.AlertTimelineChart })));
const CloudVisibilityChart = React.lazy(() =>
  import("./WeatherCharts").then((m) => ({ default: m.CloudVisibilityChart })));
const DaylightBandChart = React.lazy(() =>
  import("./WeatherCharts").then((m) => ({ default: m.DaylightBandChart })));
const PrecipitationOverlayChart = React.lazy(() =>
  import("./WeatherCharts").then((m) => ({ default: m.PrecipitationOverlayChart })));
const PressureTrendChart = React.lazy(() =>
  import("./WeatherCharts").then((m) => ({ default: m.PressureTrendChart })));
const TemperatureCurveChart = React.lazy(() =>
  import("./WeatherCharts").then((m) => ({ default: m.TemperatureCurveChart })));
const WeeklyRangeChart = React.lazy(() =>
  import("./WeatherCharts").then((m) => ({ default: m.WeeklyRangeChart })));
const WindDirectionChart = React.lazy(() =>
  import("./WeatherCharts").then((m) => ({ default: m.WindDirectionChart })));

type ForecastPanelsProps = {
  activeLocation: { latitude: number; longitude: number } | null;
  airspace: AirspaceResponse | null;
  airspaceLoading: boolean;
  currentDay: DailyWeather;
  detailView: "hourly" | "weekly" | "alerts";
  detailsLoading: boolean;
  hasAlerts: boolean;
  hasTimeline: boolean;
  hourlyCardsOpen: boolean;
  hourlyForDay: WeatherSnapshot[];
  hourlySeries: {
    temperature: Array<{ key: string; time: string; label: string; shortLabel: string; isDay: boolean; value: number }>;
    precipitation: Array<{ key: string; time: string; label: string; shortLabel: string; value: number; probability: number }>;
    wind: Array<{ key: string; time: string; label: string; shortLabel: string; value: number; direction: number }>;
    pressure: Array<{ key: string; time: string; label: string; shortLabel: string; value: number }>;
    cloudVisibility: Array<{ key: string; time: string; label: string; shortLabel: string; value: number; secondaryValue: number }>;
  };
  onDaySelect: (date: string, nextHourIndex: number) => void;
  onDetailViewChange: (view: "hourly" | "weekly" | "alerts") => void;
  preferences: Preferences;
  selectedDate: string;
  setHourlyCardsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  weeklyRange: Array<{ key: string; label: string; shortLabel: string; min: number; max: number }>;
  weather: WeatherPayload;
};

export function ForecastPanels({
  activeLocation,
  airspace,
  airspaceLoading,
  currentDay,
  detailView,
  detailsLoading,
  hasAlerts,
  hasTimeline,
  hourlyCardsOpen,
  hourlyForDay,
  hourlySeries,
  onDaySelect,
  onDetailViewChange,
  preferences,
  selectedDate,
  setHourlyCardsOpen,
  weeklyRange,
  weather,
}: ForecastPanelsProps) {
  const temperatureUnitLabel = preferences.temperatureUnit === "f" ? "F" : "C";
  const windUnitLabel = preferences.windUnit === "mph" ? "mph" : "km/h";
  const visibilityUnitLabel = preferences.visibilityUnit === "mi" ? "mi" : "km";

  return (
    <>
      <section className="airspace-panel-section">
        <AirspacePanel
          latitude={activeLocation?.latitude}
          longitude={activeLocation?.longitude}
          airspace={airspace}
          loading={airspaceLoading}
        />
      </section>

      <section className="detail-switcher-panel">
        <div className="detail-switcher">
          <button
            type="button"
            className={detailView === "hourly" ? "detail-tab active" : "detail-tab"}
            onClick={() => onDetailViewChange("hourly")}
          >
            Hourly
          </button>
          <button
            type="button"
            className={detailView === "weekly" ? "detail-tab active" : "detail-tab"}
            onClick={() => onDetailViewChange("weekly")}
          >
            7 days
          </button>
          <button
            type="button"
            className={detailView === "alerts" ? "detail-tab active" : "detail-tab"}
            onClick={() => onDetailViewChange("alerts")}
          >
            Alerts {hasAlerts ? `(${weather.alerts.length})` : ""}
          </button>
        </div>
      </section>

      {hasTimeline ? (
        <>
          {detailView === "hourly" && (
            <>
              <section className="timeline-panel">
                <div className="panel-header compact">
                  <div>
                    <p className="section-label">Daily timeline</p>
                    <h3>Choose a day</h3>
                  </div>
                </div>

                <div className="day-strip">
                  {weather.daily.map((day, index) => {
                    const offset = index - 7;
                    const phase = offset < 0 ? "History" : offset === 0 ? "Today" : "Forecast";

                    return (
                      <button
                        key={day.date}
                        type="button"
                        className={`day-chip${day.date === selectedDate ? " active" : ""}${offset === 0 ? " today" : ""}`}
                        onClick={() => {
                          const nextHourlyForDay = weather.hourly.filter((entry) => entry.time.startsWith(day.date));
                          onDaySelect(day.date, findNearestSnapshotIndex(nextHourlyForDay));
                        }}
                      >
                        <span>{phase}</span>
                        <strong>{formatDayLabel(day.date)}</strong>
                        <em>{weatherLabel(day.weatherCode)}</em>
                        <small>
                          {temperatureDisplay(day.temperatureMin, preferences.temperatureUnit)}° /{" "}
                          {temperatureDisplay(day.temperatureMax, preferences.temperatureUnit)}°
                        </small>
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className="hourly-panel visx-panel">
                <div className="panel-header compact">
                  <div>
                    <p className="section-label">Hourly detail</p>
                    <h3>{formatDayLabel(selectedDate)}</h3>
                  </div>
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => setHourlyCardsOpen((open) => !open)}
                  >
                    {hourlyCardsOpen ? "Hide hourly cards" : "Show hourly cards"}
                  </button>
                </div>

                <Suspense fallback={<div className="charts-loading-placeholder" />}>
                  <div className="hourly-chart-grid visx-grid">
                    <TemperatureCurveChart points={hourlySeries.temperature} units={temperatureUnitLabel} />
                    <PrecipitationOverlayChart points={hourlySeries.precipitation} />
                    <WindDirectionChart points={hourlySeries.wind} units={windUnitLabel} />
                  </div>

                  <div className="secondary-chart-grid">
                    <PressureTrendChart points={hourlySeries.pressure} />
                    <CloudVisibilityChart points={hourlySeries.cloudVisibility} visibilityUnits={visibilityUnitLabel} />
                    <DaylightBandChart
                      sunrise={currentDay.sunrise}
                      sunset={currentDay.sunset}
                      hourCycle={preferences.hourCycle}
                    />
                  </div>
                </Suspense>
              </section>

              {hourlyCardsOpen && (
                <section className="hourly-panel">
                  <div className="panel-header compact">
                    <div>
                      <p className="section-label">Hourly cards</p>
                      <h3>Detailed readout</h3>
                    </div>
                  </div>

                  <div className="hourly-grid upgraded-hourly-grid">
                    {hourlyForDay.map((entry) => (
                      <article key={entry.time} className="hour-card">
                        <div className="hour-card-top">
                          <strong>{formatHourLabel(entry.time, preferences.hourCycle)}</strong>
                          <span>{weatherLabel(entry.weatherCode)}</span>
                        </div>
                        <div className="hour-summary-row">
                          <p className="hour-temp">
                            {temperatureDisplay(entry.temperature, preferences.temperatureUnit)}°
                          </p>
                          <div className="mini-wind">
                            <span
                              className="mini-wind-arrow"
                              style={{ transform: `rotate(${entry.windDirection}deg)` }}
                              aria-hidden="true"
                            />
                            <strong>{windDirectionLabel(entry.windDirection)}</strong>
                          </div>
                        </div>
                        <dl>
                          <div>
                            <dt>Wind</dt>
                            <dd>{windSpeedDisplay(entry.windSpeed, preferences.windUnit)} {windUnitLabel}</dd>
                          </div>
                          <div>
                            <dt>Gusts</dt>
                            <dd>{windSpeedDisplay(entry.windGusts, preferences.windUnit)} {windUnitLabel}</dd>
                          </div>
                          <div>
                            <dt>Dir</dt>
                            <dd>{Math.round(entry.windDirection)}°</dd>
                          </div>
                          <div>
                            <dt>Rain</dt>
                            <dd>
                              {entry.precipitationAmount.toFixed(1)} mm - {Math.round(entry.precipitationProbability)}%
                            </dd>
                          </div>
                          <div>
                            <dt>Clouds</dt>
                            <dd>{Math.round(entry.cloudCover)}%</dd>
                          </div>
                          <div>
                            <dt>Visibility</dt>
                            <dd>
                              {visibilityDisplay(entry.visibility / 1000, preferences.visibilityUnit)} {visibilityUnitLabel}
                            </dd>
                          </div>
                        </dl>
                      </article>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}

          {detailView === "weekly" && (
            <section className="timeline-panel">
              <div className="panel-header compact">
                <div>
                  <p className="section-label">Weekly outlook</p>
                  <h3>Next 7 days</h3>
                </div>
              </div>

              <div className="weekly-chart-wrap">
                <Suspense fallback={<div className="charts-loading-placeholder" />}>
                  <WeeklyRangeChart points={weeklyRange} units={temperatureUnitLabel} />
                </Suspense>
              </div>
            </section>
          )}
        </>
      ) : (
        detailsLoading && (
          <section className="timeline-panel">
            <div className="panel-header compact">
              <div>
                <p className="section-label">Forecast loading</p>
                <h3>Charts and timeline are on the way</h3>
              </div>
            </div>
            <p className="muted">
              Current conditions are ready. Loading hourly charts, the 14-day timeline, and alerts in the background.
            </p>
          </section>
        )
      )}

      {detailView === "alerts" && !detailsLoading && (
        <section className="timeline-panel alerts-panel">
          <div className="panel-header compact">
            <div>
              <p className="section-label">Active alerts</p>
              <h3>{weather.alerts.length > 0 ? "Weather warnings for this area" : "No active severe alerts"}</h3>
            </div>
          </div>

          {weather.alerts.length > 0 ? (
            <div className="alerts-layout">
              <Suspense fallback={null}>
                <AlertTimelineChart alerts={weather.alerts} hourCycle={preferences.hourCycle} />
              </Suspense>
              <div className="alerts-grid">
                {weather.alerts.map((alert) => (
                  <article key={alert.id} className="alert-card">
                    <p className="alert-chip">
                      {alert.severity} - {alert.urgency}
                    </p>
                    <h4>{alert.event}</h4>
                    <p>{alert.headline}</p>
                    <small>{alert.area}</small>
                  </article>
                ))}
              </div>
            </div>
          ) : (
            <div className="chart-empty-state alerts-empty-state">
              Severe weather warnings will appear here whenever the provider reports an active alert window.
            </div>
          )}
        </section>
      )}
    </>
  );
}
