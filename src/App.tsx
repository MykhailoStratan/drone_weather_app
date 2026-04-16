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
  const satelliteEstimate = currentSnapshot
    ? estimateVisibleSatellites(
        currentSnapshot.cloudCover,
        currentSnapshot.visibility,
        currentSnapshot.isDay,
      )
    : 0;

  return (
    <main className="app-shell">
      <section className="hero-card">
        <div className="hero-copy">
          <p className="eyebrow">SkyCanvas Weather</p>
          <h1>Weather state, history, and next-step planning in one screen.</h1>
          <p className="hero-text">
            A clean web foundation for today, with shared app logic that can later move into iOS and Android clients.
          </p>
        </div>

        <div className="search-panel">
          <label className="search-label" htmlFor="location-search">
            Search a city or region
          </label>
          <div className="search-row">
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
            <div className="results-panel">
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
      </section>

      {loading || !weather || !currentDay || !currentSnapshot ? (
        <section className="loading-card">
          <div className="spinner" />
          <p>Pulling the latest forecast and recent history...</p>
        </section>
      ) : (
        <>
          <section className="overview-grid">
            <article className="primary-panel">
              <div className="panel-header">
                <div>
                  <p className="section-label">{weather.locationLabel}</p>
                  <h2>{weatherLabel(currentSnapshot.weatherCode)}</h2>
                </div>
                <span className="temperature-pill">{Math.round(currentSnapshot.temperature)} C</span>
              </div>

              <div className="headline-metrics">
                <Metric label="Sunrise" value={formatTime(currentDay.sunrise)} />
                <Metric label="Sunset" value={formatTime(currentDay.sunset)} />
                <Metric label="Wind" value={`${Math.round(currentSnapshot.windSpeed)} km/h`} />
                <Metric label="Gusts" value={`${Math.round(currentSnapshot.windGusts)} km/h`} />
                <Metric
                  label="Direction"
                  value={`${windDirectionLabel(currentSnapshot.windDirection)} ${Math.round(currentSnapshot.windDirection)} deg`}
                />
                <Metric label="Precip." value={`${Math.round(currentSnapshot.precipitationProbability)}%`} />
                <Metric label="Cloud cover" value={`${Math.round(currentSnapshot.cloudCover)}%`} />
                <Metric label="Visibility" value={`${(currentSnapshot.visibility / 1000).toFixed(1)} km`} />
                <Metric label="Air pressure" value={`${Math.round(currentSnapshot.pressure)} hPa`} />
                <Metric label="Est. visible sats" value={String(satelliteEstimate)} />
              </div>
            </article>

            <article className="stat-panel">
              <p className="section-label">This day</p>
              <h3>{formatDayLabel(currentDay.date)}</h3>
              <div className="day-range">
                <span>{Math.round(currentDay.temperatureMin)} deg</span>
                <div className="range-bar" />
                <span>{Math.round(currentDay.temperatureMax)} deg</span>
              </div>
              <p className="muted">
                {Math.round(currentDay.precipitationSum)} mm precipitation over {Math.round(currentDay.precipitationHours)} hours.
              </p>
            </article>

            <article className="stat-panel">
              <p className="section-label">Coverage</p>
              <h3>7 days back + 7 days ahead</h3>
              <p className="muted">
                Timeline includes recent weather history and the next week of forecast data in {weather.timezone}.
              </p>
            </article>
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

            <div className="hourly-grid">
              {(hourlyForDay ?? []).map((entry) => (
                <article key={entry.time} className="hour-card">
                  <div className="hour-card-top">
                    <strong>{formatHourLabel(entry.time)}</strong>
                    <span>{weatherLabel(entry.weatherCode)}</span>
                  </div>
                  <p className="hour-temp">{Math.round(entry.temperature)} C</p>
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
                      <dd>{windDirectionLabel(entry.windDirection)}</dd>
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

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
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
