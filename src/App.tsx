import { useEffect, useRef, useState } from "react";
import { estimateVisibleSatellites, formatDayLabel, formatHourLabel, formatTime, weatherLabel, windDirectionLabel } from "./lib/format";
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

function App() {
  const [query, setQuery] = useState("Vancouver");
  const [results, setResults] = useState<LocationOption[]>([]);
  const [weather, setWeather] = useState<WeatherPayload | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [message, setMessage] = useState<string>("");
  const debounce = useRef<number | null>(null);

  useEffect(() => {
    void loadWeather(starterLocation);
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

  const currentDay = weather?.daily.find((day) => day.date === selectedDate) ?? weather?.daily[0];
  const hourlyForDay = weather?.hourly.filter((entry) => entry.time.startsWith(selectedDate));
  const currentSnapshot = resolveCurrentSnapshot(hourlyForDay, weather?.current);
  const temperatureTrack = createMetricTrack(hourlyForDay ?? [], (entry) => entry.temperature);
  const precipitationTrack = createMetricTrack(hourlyForDay ?? [], (entry) => entry.precipitationProbability);
  const satelliteEstimate = currentSnapshot
    ? estimateVisibleSatellites(
        currentSnapshot.cloudCover,
        currentSnapshot.visibility,
        currentSnapshot.isDay,
      )
    : 0;

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
                  <span className="temperature-value">{Math.round(currentSnapshot.temperature)}</span>
                  <span className="temperature-unit">C</span>
                  <p className="temperature-range">
                    {Math.round(currentDay.temperatureMin)} / {Math.round(currentDay.temperatureMax)} C
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
                        {Math.round(currentSnapshot.windSpeed)} km/h wind with gusts up to {Math.round(currentSnapshot.windGusts)} km/h
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="hero-mini-grid">
                <Metric icon="☀" label="Sunrise" value={formatTime(currentDay.sunrise)} />
                <Metric icon="☾" label="Sunset" value={formatTime(currentDay.sunset)} />
                <Metric icon="☔" label="Precip." value={`${Math.round(currentSnapshot.precipitationProbability)}%`} />
                <Metric icon="☁" label="Cloud cover" value={`${Math.round(currentSnapshot.cloudCover)}%`} />
                <Metric icon="◌" label="Visibility" value={`${(currentSnapshot.visibility / 1000).toFixed(1)} km`} />
                <Metric icon="◍" label="Pressure" value={`${Math.round(currentSnapshot.pressure)} hPa`} />
              </div>
            </article>

            <article className="stat-panel insight-panel">
              <p className="section-label">Daily read</p>
              <h3>{formatDayLabel(currentDay.date)}</h3>
              <div className="insight-stack">
                <div className="range-summary">
                  <div className="range-header">
                    <span>Temperature arc</span>
                    <strong>{temperatureTrack.min} to {temperatureTrack.max} C</strong>
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
                <p className="muted">Estimated visible satellites tonight: {satelliteEstimate}</p>
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
                      {Math.round(day.temperatureMin)} deg / {Math.round(day.temperatureMax)} deg
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

            <div className="hourly-grid upgraded-hourly-grid">
              {(hourlyForDay ?? []).map((entry) => (
                <article key={entry.time} className="hour-card">
                  <div className="hour-card-top">
                    <strong>{formatHourLabel(entry.time)}</strong>
                    <span>{weatherLabel(entry.weatherCode)}</span>
                  </div>
                  <div className="hour-summary-row">
                    <p className="hour-temp">{Math.round(entry.temperature)} C</p>
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
                      <dd>{Math.round(entry.windSpeed)} km/h</dd>
                    </div>
                    <div>
                      <dt>Gusts</dt>
                      <dd>{Math.round(entry.windGusts)} km/h</dd>
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
                      <dd>{(entry.visibility / 1000).toFixed(1)} km</dd>
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

function createMetricTrack(
  entries: WeatherSnapshot[],
  select: (entry: WeatherSnapshot) => number,
) {
  if (!entries.length) {
    return { min: 0, max: 0, points: [] as Array<{ key: string; height: number }> };
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
