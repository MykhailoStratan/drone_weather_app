import { useEffect, useRef, useState } from "react";
import {
  formatDayLabel,
  formatHourLabel,
  formatTime,
  temperatureDisplay,
  visibilityDisplay,
  weatherLabel,
  windDirectionLabel,
  windSpeedDisplay,
} from "./lib/format";
import { fetchWeather, searchLocations } from "./lib/weather";
import type { LocationOption, WeatherPayload, WeatherSnapshot } from "./types";

const starterLocation: LocationOption = {
  id: 1,
  name: "Vancouver",
  admin1: "British Columbia",
  country: "Canada",
  latitude: 49.2497,
  longitude: -123.1193,
  timezone: "America/Vancouver",
};

const SAVED_LOCATIONS_KEY = "skycanvas.savedLocations";
const LAST_LOCATION_KEY = "skycanvas.lastLocation";
const PREFERENCES_KEY = "skycanvas.preferences";

type Preferences = {
  temperatureUnit: "c" | "f";
  windUnit: "kmh" | "mph";
  visibilityUnit: "km" | "mi";
  hourCycle: "12h" | "24h";
};

const defaultPreferences: Preferences = {
  temperatureUnit: "c",
  windUnit: "kmh",
  visibilityUnit: "km",
  hourCycle: "12h",
};

function App() {
  const [query, setQuery] = useState("Vancouver");
  const [results, setResults] = useState<LocationOption[]>([]);
  const [weather, setWeather] = useState<WeatherPayload | null>(null);
  const [activeLocation, setActiveLocation] = useState<LocationOption | null>(null);
  const [savedLocations, setSavedLocations] = useState<LocationOption[]>([]);
  const [preferences, setPreferences] = useState<Preferences>(defaultPreferences);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [message, setMessage] = useState<string>("");
  const debounce = useRef<number | null>(null);

  useEffect(() => {
    const storedLocations = readStoredLocations();
    const preferredLocation = readStoredLocation(LAST_LOCATION_KEY) ?? starterLocation;
    setSavedLocations(storedLocations);
    setPreferences(readStoredPreferences());
    void loadWeather(preferredLocation);
  }, []);

  useEffect(() => {
    if (debounce.current) {
      window.clearTimeout(debounce.current);
    }

    if (query.trim().length < 2) {
      setResults([]);
      return;
    }

    debounce.current = window.setTimeout(() => {
      void loadSearchResults(query);
    }, 250);

    return () => {
      if (debounce.current) {
        window.clearTimeout(debounce.current);
      }
    };
  }, [query]);

  async function loadWeather(location: LocationOption) {
    setLoading(true);
    setMessage("");

    try {
      const payload = await fetchWeather(location);
      setWeather(payload);
      setSelectedDate(payload.daily[7]?.date ?? payload.daily[0]?.date ?? "");
      setResults([]);
      setQuery(location.name);
      setActiveLocation(location);
      storeLocation(LAST_LOCATION_KEY, location);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load weather.");
    } finally {
      setLoading(false);
    }
  }

  async function loadSearchResults(value: string) {
    setSearching(true);
    try {
      const matches = await searchLocations(value);
      setResults(matches);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to search locations.");
    } finally {
      setSearching(false);
    }
  }

  function requestCurrentLocation() {
    if (!navigator.geolocation) {
      setMessage("Geolocation is not supported by this browser.");
      return;
    }

    setLoading(true);
    setMessage("");

    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        const currentLocation: LocationOption = {
          id: 0,
          name: "Current location",
          country: "Detected by device",
          latitude: coords.latitude,
          longitude: coords.longitude,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        };

        await loadWeather(currentLocation);
      },
      () => {
        setLoading(false);
        setMessage("Location permission was denied. Search for a place instead.");
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  function saveActiveLocation() {
    if (!activeLocation || activeLocation.id === 0) {
      setMessage("Search for a city or region before saving a location.");
      return;
    }

    const nextLocations = upsertLocation(savedLocations, activeLocation);
    setSavedLocations(nextLocations);
    storeLocations(nextLocations);
    setMessage(`${activeLocation.name} saved.`);
  }

  function removeSavedLocation(locationId: number) {
    const nextLocations = savedLocations.filter((location) => location.id !== locationId);
    setSavedLocations(nextLocations);
    storeLocations(nextLocations);
  }

  function updatePreferences(nextPreferences: Preferences) {
    setPreferences(nextPreferences);
    window.localStorage.setItem(PREFERENCES_KEY, JSON.stringify(nextPreferences));
  }

  const currentDay = weather?.daily.find((day) => day.date === selectedDate) ?? weather?.daily[0];
  const hourlyForDay = weather?.hourly.filter((entry) => entry.time.startsWith(selectedDate));
  const currentSnapshot = resolveCurrentSnapshot(hourlyForDay, weather?.current);
  const temperatureTrack = createMetricTrack(
    hourlyForDay ?? [],
    (entry) => temperatureDisplay(entry.temperature, preferences.temperatureUnit),
    preferences.hourCycle,
  );
  const precipitationTrack = createMetricTrack(
    hourlyForDay ?? [],
    (entry) => entry.precipitationProbability,
    preferences.hourCycle,
  );
  const windTrack = createMetricTrack(
    hourlyForDay ?? [],
    (entry) => windSpeedDisplay(entry.windSpeed, preferences.windUnit),
    preferences.hourCycle,
  );
  const temperatureUnitLabel = preferences.temperatureUnit === "f" ? "F" : "C";
  const windUnitLabel = preferences.windUnit === "mph" ? "mph" : "km/h";
  const visibilityUnitLabel = preferences.visibilityUnit === "mi" ? "mi" : "km";
  return (
    <main className="app-shell">
      {loading || !weather || !currentDay || !currentSnapshot ? (
        <section className="loading-card">
          <div className="spinner" />
          <p>Pulling the latest forecast and recent history...</p>
        </section>
      ) : (
        <>
          <section className="top-layout">
            <aside className="sidebar-card">
              <div className="sidebar-copy">
                <p className="eyebrow">SkyCanvas Weather</p>
                <h1>Current weather first.</h1>
                <p className="hero-text">
                  Search a place or use your device location to update the live conditions view.
                </p>
              </div>

              <div className="search-panel sidebar-search">
                <label className="search-label" htmlFor="location-search">
                  Search a city or region
                </label>
                <div className="search-row sidebar-search-row">
                  <input
                    id="location-search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Try Vancouver, Seattle, Tokyo..."
                  />
                  <button type="button" className="secondary-button" onClick={requestCurrentLocation}>
                    Use my location
                  </button>
                </div>

                {(results.length > 0 || searching) && (
                  <div className="results-panel compact-results">
                    {searching && <p className="muted">Searching...</p>}
                    {results.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        className="result-item"
                        onClick={() => void loadWeather(option)}
                      >
                        <strong>{option.name}</strong>
                        <span>{[option.admin1, option.country].filter(Boolean).join(", ")}</span>
                      </button>
                    ))}
                  </div>
                )}

                {message && <p className="status-message">{message}</p>}
              </div>

              <div className="saved-panel">
                <div className="saved-header">
                  <div>
                    <p className="section-label">Saved places</p>
                    <h3>Quick access</h3>
                  </div>
                  <button type="button" className="ghost-button" onClick={saveActiveLocation}>
                    Save current
                  </button>
                </div>

                {savedLocations.length === 0 ? (
                  <p className="muted">No saved places yet. Save a city to pin it here.</p>
                ) : (
                  <div className="saved-list">
                    {savedLocations.map((location) => (
                      <div key={location.id} className="saved-item">
                        <button
                          type="button"
                          className="saved-location-button"
                          onClick={() => void loadWeather(location)}
                        >
                          <strong>{location.name}</strong>
                          <span>{[location.admin1, location.country].filter(Boolean).join(", ")}</span>
                        </button>
                        <button
                          type="button"
                          className="saved-remove-button"
                          onClick={() => removeSavedLocation(location.id)}
                          aria-label={`Remove ${location.name}`}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="saved-panel">
                <div className="saved-header">
                  <div>
                    <p className="section-label">Preferences</p>
                    <h3>Display units</h3>
                  </div>
                </div>

                <div className="preference-group">
                  <span className="preference-label">Temperature</span>
                  <div className="segmented-control">
                    <button
                      type="button"
                      className={preferences.temperatureUnit === "c" ? "segment active" : "segment"}
                      onClick={() => updatePreferences({ ...preferences, temperatureUnit: "c" })}
                    >
                      C
                    </button>
                    <button
                      type="button"
                      className={preferences.temperatureUnit === "f" ? "segment active" : "segment"}
                      onClick={() => updatePreferences({ ...preferences, temperatureUnit: "f" })}
                    >
                      F
                    </button>
                  </div>
                </div>

                <div className="preference-group">
                  <span className="preference-label">Wind and visibility</span>
                  <div className="segmented-control">
                    <button
                      type="button"
                      className={preferences.windUnit === "kmh" ? "segment active" : "segment"}
                      onClick={() =>
                        updatePreferences({
                          ...preferences,
                          windUnit: "kmh",
                          visibilityUnit: "km",
                        })
                      }
                    >
                      Metric
                    </button>
                    <button
                      type="button"
                      className={preferences.windUnit === "mph" ? "segment active" : "segment"}
                      onClick={() =>
                        updatePreferences({
                          ...preferences,
                          windUnit: "mph",
                          visibilityUnit: "mi",
                        })
                      }
                    >
                      Imperial
                    </button>
                  </div>
                </div>

                <div className="preference-group">
                  <span className="preference-label">Time</span>
                  <div className="segmented-control">
                    <button
                      type="button"
                      className={preferences.hourCycle === "12h" ? "segment active" : "segment"}
                      onClick={() => updatePreferences({ ...preferences, hourCycle: "12h" })}
                    >
                      12h
                    </button>
                    <button
                      type="button"
                      className={preferences.hourCycle === "24h" ? "segment active" : "segment"}
                      onClick={() => updatePreferences({ ...preferences, hourCycle: "24h" })}
                    >
                      24h
                    </button>
                  </div>
                </div>
              </div>
            </aside>

            <section className="overview-grid premium-grid primary-priority">
            <article className="primary-panel hero-conditions">
              <div className="hero-topline">
                <div>
                  <p className="section-label">{weather.locationLabel}</p>
                  <h2>{weatherLabel(currentSnapshot.weatherCode)}</h2>
                </div>
                <span className="summary-badge">{formatDayLabel(currentDay.date)}</span>
              </div>

              <div className="hero-stats">
                <div className="temperature-block">
                  <span className="temperature-value">
                    {temperatureDisplay(currentSnapshot.temperature, preferences.temperatureUnit)}
                  </span>
                  <span className="temperature-unit">{temperatureUnitLabel}</span>
                  <p className="temperature-range">
                    {temperatureDisplay(currentDay.temperatureMin, preferences.temperatureUnit)} /{" "}
                    {temperatureDisplay(currentDay.temperatureMax, preferences.temperatureUnit)}{" "}
                    {temperatureUnitLabel}
                  </p>
                </div>

                <div className="wind-spotlight">
                  <p className="section-label">Wind direction</p>
                  <div className="wind-visual">
                    <div className="wind-arrow-ring">
                      <span
                        className="wind-arrow"
                        style={{ transform: `rotate(${currentSnapshot.windDirection}deg)` }}
                        aria-hidden="true"
                      >
                        ↑
                      </span>
                    </div>
                    <div>
                      <strong>
                        {windDirectionLabel(currentSnapshot.windDirection)} {Math.round(currentSnapshot.windDirection)} deg
                      </strong>
                      <p className="muted">
                        {windSpeedDisplay(currentSnapshot.windSpeed, preferences.windUnit)} {windUnitLabel} wind with gusts up to{" "}
                        {windSpeedDisplay(currentSnapshot.windGusts, preferences.windUnit)} {windUnitLabel}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="hero-mini-grid">
                <Metric icon="SR" label="Sunrise" value={formatTime(currentDay.sunrise, preferences.hourCycle)} />
                <Metric icon="SS" label="Sunset" value={formatTime(currentDay.sunset, preferences.hourCycle)} />
                <Metric icon="☔" label="Precip." value={`${Math.round(currentSnapshot.precipitationProbability)}%`} />
                <Metric icon="☁" label="Cloud cover" value={`${Math.round(currentSnapshot.cloudCover)}%`} />
                <Metric
                  icon="VS"
                  label="Visibility"
                  value={`${visibilityDisplay(currentSnapshot.visibility / 1000, preferences.visibilityUnit)} ${visibilityUnitLabel}`}
                />
                <Metric icon="PR" label="Pressure" value={`${Math.round(currentSnapshot.pressure)} hPa`} />
              </div>
            </article>

            <article className="stat-panel insight-panel">
              <p className="section-label">Daily read</p>
              <h3>{formatDayLabel(currentDay.date)}</h3>
              <div className="insight-stack">
                <div className="range-summary">
                  <div className="range-header">
                    <span>Temperature arc</span>
                    <strong>{temperatureTrack.min} to {temperatureTrack.max} {temperatureUnitLabel}</strong>
                  </div>
                  <div className="sparkline sparkline-temperature" aria-hidden="true">
                    {temperatureTrack.points.map((point) => (
                      <span key={point.key} style={{ height: `${point.height}%` }} />
                    ))}
                  </div>
                </div>
                <p className="muted">
                  {Math.round(currentDay.precipitationSum)} mm precipitation spread across {Math.round(currentDay.precipitationHours)} hours.
                </p>
              </div>
            </article>

            <article className="stat-panel insight-panel">
              <p className="section-label">Precipitation rhythm</p>
              <h3>Chance through the day</h3>
              <div className="rain-chart" aria-hidden="true">
                {precipitationTrack.points.map((point) => (
                  <span key={point.key} style={{ height: `${point.height}%` }} />
                ))}
              </div>
              <p className="muted">
                Timeline includes recent weather history and the next week of forecast data in {weather.timezone}.
              </p>
            </article>
          </section>
          </section>

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
                    className={day.date === selectedDate ? "day-chip active" : "day-chip"}
                    onClick={() => setSelectedDate(day.date)}
                  >
                    <span>{phase}</span>
                    <strong>{formatDayLabel(day.date)}</strong>
                    <em>{weatherLabel(day.weatherCode)}</em>
                    <small>
                      {temperatureDisplay(day.temperatureMin, preferences.temperatureUnit)} {temperatureUnitLabel} /{" "}
                      {temperatureDisplay(day.temperatureMax, preferences.temperatureUnit)} {temperatureUnitLabel}
                    </small>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="hourly-panel">
            <div className="panel-header compact">
              <div>
                <p className="section-label">Hourly detail</p>
                <h3>{formatDayLabel(selectedDate)}</h3>
              </div>
            </div>

            <div className="hourly-chart-grid">
              <ChartCard
                title="Temperature"
                units={temperatureUnitLabel}
                tone="temperature"
                points={temperatureTrack.points}
                min={temperatureTrack.min}
                max={temperatureTrack.max}
                hourCycle={preferences.hourCycle}
              />
              <ChartCard
                title="Wind"
                units={windUnitLabel}
                tone="wind"
                points={windTrack.points}
                min={windTrack.min}
                max={windTrack.max}
                hourCycle={preferences.hourCycle}
              />
              <ChartCard
                title="Precipitation"
                units="%"
                tone="precipitation"
                points={precipitationTrack.points}
                min={precipitationTrack.min}
                max={precipitationTrack.max}
                hourCycle={preferences.hourCycle}
              />
            </div>

            <div className="hourly-grid upgraded-hourly-grid">
              {(hourlyForDay ?? []).map((entry) => (
                <article key={entry.time} className="hour-card">
                  <div className="hour-card-top">
                    <strong>{formatHourLabel(entry.time, preferences.hourCycle)}</strong>
                    <span>{weatherLabel(entry.weatherCode)}</span>
                  </div>
                  <div className="hour-summary-row">
                    <p className="hour-temp">
                      {temperatureDisplay(entry.temperature, preferences.temperatureUnit)} {temperatureUnitLabel}
                    </p>
                    <div className="mini-wind">
                      <span
                        className="mini-wind-arrow"
                        style={{ transform: `rotate(${entry.windDirection}deg)` }}
                        aria-hidden="true"
                      >
                        ↑
                      </span>
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
                      <dd>{Math.round(entry.windDirection)} deg</dd>
                    </div>
                    <div>
                      <dt>Rain</dt>
                      <dd>{Math.round(entry.precipitationProbability)}%</dd>
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
        </>
      )}
    </main>
  );
}

function Metric({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="metric-card">
      <span className="metric-icon" aria-hidden="true">{icon}</span>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ChartCard({
  title,
  units,
  tone,
  points,
  min,
  max,
  hourCycle,
}: {
  title: string;
  units: string;
  tone: "temperature" | "wind" | "precipitation";
  points: Array<{ key: string; height: number; label: string }>;
  min: number;
  max: number;
  hourCycle: "12h" | "24h";
}) {
  const polyline = points
    .map((point, index) => {
      const x = points.length === 1 ? 50 : (index / (points.length - 1)) * 100;
      const y = 100 - point.height;
      return `${x},${y}`;
    })
    .join(" ");

  const ticks = points.filter((_, index) => {
    if (points.length <= 4) {
      return true;
    }

    const spacing = Math.max(1, Math.floor(points.length / 4));
    return index === 0 || index === points.length - 1 || index % spacing === 0;
  });

  return (
    <article className="chart-card">
      <div className="chart-card-header">
        <div>
          <p className="section-label">{title}</p>
          <strong>
            {min} to {max} {units}
          </strong>
        </div>
      </div>
      <div className={`chart-shell ${tone}`} aria-hidden="true">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="chart-svg">
          <polyline className="chart-line" points={polyline} />
          {points.map((point, index) => {
            const x = points.length === 1 ? 50 : (index / (points.length - 1)) * 100;
            const y = 100 - point.height;
            return <circle key={point.key} className="chart-dot" cx={x} cy={y} r="1.8" />;
          })}
        </svg>
      </div>
      <div className="chart-ticks">
        {ticks.map((point) => (
          <span key={`${point.key}-tick`}>{point.label}</span>
        ))}
      </div>
    </article>
  );
}

function createMetricTrack(
  entries: WeatherSnapshot[],
  select: (entry: WeatherSnapshot) => number,
  hourCycle: "12h" | "24h",
) {
  if (!entries.length) {
    return { min: 0, max: 0, points: [] as Array<{ key: string; height: number; label: string }> };
  }

  const values = entries.map(select);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  return {
    min: Math.round(min),
    max: Math.round(max),
    points: entries.map((entry, index) => ({
      key: `${entry.time}-${index}`,
      height: 24 + ((select(entry) - min) / range) * 76,
      label: formatHourLabel(entry.time, hourCycle),
    })),
  };
}

function resolveCurrentSnapshot(hourlyForDay: WeatherSnapshot[] | undefined, current: WeatherPayload["current"] | undefined) {
  if (!hourlyForDay?.length) {
    return current;
  }

  const now = Date.now();
  return hourlyForDay.reduce((closest, entry) => {
    const distance = Math.abs(new Date(entry.time).getTime() - now);
    const closestDistance = Math.abs(new Date(closest.time).getTime() - now);
    return distance < closestDistance ? entry : closest;
  }, hourlyForDay[0]);
}

export default App;

function readStoredLocations() {
  try {
    const raw = window.localStorage.getItem(SAVED_LOCATIONS_KEY);
    return raw ? (JSON.parse(raw) as LocationOption[]) : [];
  } catch {
    return [];
  }
}

function readStoredLocation(key: string) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as LocationOption) : null;
  } catch {
    return null;
  }
}

function readStoredPreferences(): Preferences {
  try {
    const raw = window.localStorage.getItem(PREFERENCES_KEY);
    return raw
      ? { ...defaultPreferences, ...(JSON.parse(raw) as Partial<Preferences>) }
      : defaultPreferences;
  } catch {
    return defaultPreferences;
  }
}

function storeLocations(locations: LocationOption[]) {
  window.localStorage.setItem(SAVED_LOCATIONS_KEY, JSON.stringify(locations));
}

function storeLocation(key: string, location: LocationOption) {
  window.localStorage.setItem(key, JSON.stringify(location));
}

function upsertLocation(locations: LocationOption[], nextLocation: LocationOption) {
  const existing = locations.filter((location) => location.id !== nextLocation.id);
  return [nextLocation, ...existing].slice(0, 6);
}
