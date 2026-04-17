import { useEffect, useRef, useState } from "react";
import {
  AlertTimelineChart,
  CloudVisibilityChart,
  DaylightBandChart,
  PrecipitationOverlayChart,
  PressureTrendChart,
  TemperatureCurveChart,
  WeeklyRangeChart,
  WindDirectionChart,
  buildHourlySeries,
  buildWeeklyRangeSeries,
} from "./components/WeatherCharts";
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
import { fetchWeatherAlerts, fetchWeatherOverview, fetchWeatherTimeline, searchLocations } from "./lib/weather";
import type { LocationOption, WeatherOverviewResponse, WeatherPayload, WeatherSnapshot } from "./types";

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
const LAST_OVERVIEW_KEY = "skycanvas.lastOverview";

type Preferences = {
  temperatureUnit: "c" | "f";
  windUnit: "kmh" | "mph";
  visibilityUnit: "km" | "mi";
  hourCycle: "12h" | "24h";
};

type CachedOverview = {
  savedAt: string;
  location: LocationOption;
  overview: WeatherOverviewResponse;
};

type DataStatus = {
  savedAt: string;
  source: "cached" | "live";
};

type DetailView = "hourly" | "weekly" | "alerts";

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
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [message, setMessage] = useState("");
  const [dataStatus, setDataStatus] = useState<DataStatus | null>(null);
  const [detailView, setDetailView] = useState<DetailView>("hourly");
  const [hourlyCardsOpen, setHourlyCardsOpen] = useState(false);
  const debounce = useRef<number | null>(null);
  const requestId = useRef(0);

  useEffect(() => {
    const storedLocations = readStoredLocations();
    const preferredLocation = readStoredLocation(LAST_LOCATION_KEY) ?? starterLocation;
    const cachedOverview = readStoredOverview();
    setSavedLocations(storedLocations);
    setPreferences(readStoredPreferences());
    if (cachedOverview) {
      setWeather(buildWeatherFromOverview(cachedOverview.overview));
      setSelectedDate(cachedOverview.overview.today.date);
      setActiveLocation(cachedOverview.location);
      setQuery(cachedOverview.location.name);
      setDataStatus({ savedAt: cachedOverview.savedAt, source: "cached" });
      setLoading(false);
    }
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
    const nextRequestId = requestId.current + 1;
    requestId.current = nextRequestId;
    setLoading(true);
    setDetailsLoading(true);
    setMessage("");

    try {
      const overview = await fetchWeatherOverview(location);
      if (requestId.current !== nextRequestId) {
        return;
      }

      const initialPayload: WeatherPayload = {
        locationLabel: overview.locationLabel,
        timezone: overview.timezone,
        latitude: overview.latitude,
        longitude: overview.longitude,
        current: overview.current,
        hourly: [],
        daily: [overview.today],
        alerts: [],
      };

      setWeather(initialPayload);
      setSelectedDate(overview.today.date);
      setDetailView("hourly");
      setResults([]);
      setQuery(location.name);
      setActiveLocation(location);
      storeOverview(location, overview);
      setDataStatus({ savedAt: new Date().toISOString(), source: "live" });
      storeLocation(LAST_LOCATION_KEY, location);
      setLoading(false);

      void Promise.allSettled([fetchWeatherTimeline(location), fetchWeatherAlerts(location)]).then((results) => {
        if (requestId.current !== nextRequestId) {
          return;
        }

        const [timelineResult, alertsResult] = results;

        setWeather((currentWeather) => {
          if (!currentWeather) {
            return currentWeather;
          }

          return {
            ...currentWeather,
            hourly: timelineResult.status === "fulfilled" ? timelineResult.value.hourly : currentWeather.hourly,
            daily: timelineResult.status === "fulfilled" ? timelineResult.value.daily : currentWeather.daily,
            alerts: alertsResult.status === "fulfilled" ? alertsResult.value.alerts : currentWeather.alerts,
          };
        });

        if (timelineResult.status === "rejected") {
          setMessage(
            timelineResult.reason instanceof Error
              ? timelineResult.reason.message
              : "Some forecast details are unavailable right now.",
          );
        }

        if (alertsResult.status === "rejected" && timelineResult.status !== "rejected") {
          setMessage(
            alertsResult.reason instanceof Error
              ? alertsResult.reason.message
              : "Weather alerts are unavailable right now.",
          );
        }

        setDetailsLoading(false);
      });
    } catch (error) {
      if (requestId.current === nextRequestId) {
        setMessage(error instanceof Error ? error.message : "Unable to load weather.");
        setLoading(false);
        setDetailsLoading(false);
      }
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

  function handleSavedLocationChange(locationId: number) {
    const nextLocation = savedLocations.find((location) => location.id === locationId);
    if (nextLocation) {
      void loadWeather(nextLocation);
    }
  }

  const currentDay = weather?.daily.find((day) => day.date === selectedDate) ?? weather?.daily[0];
  const hourlyForDay = weather?.hourly.filter((entry) => entry.time.startsWith(selectedDate)) ?? [];
  const hasTimeline = (weather?.daily.length ?? 0) > 1 && (weather?.hourly.length ?? 0) > 0;
  const hasAlerts = (weather?.alerts.length ?? 0) > 0;
  const showSearchFeedback = query.trim().length >= 2;
  const currentSnapshot = resolveCurrentSnapshot(hourlyForDay, weather?.current);
  const weatherIcon = weatherGlyph(currentSnapshot?.weatherCode ?? 0, currentSnapshot?.isDay === 1);
  const temperatureUnitLabel = preferences.temperatureUnit === "f" ? "F" : "C";
  const windUnitLabel = preferences.windUnit === "mph" ? "mph" : "km/h";
  const visibilityUnitLabel = preferences.visibilityUnit === "mi" ? "mi" : "km";
  const visibilityFactor = preferences.visibilityUnit === "mi" ? 0.000621371 : 0.001;
  const hourlySeries = buildHourlySeries(
    hourlyForDay.map((entry) => ({
      ...entry,
      temperature: temperatureDisplay(entry.temperature, preferences.temperatureUnit),
      windSpeed: windSpeedDisplay(entry.windSpeed, preferences.windUnit),
    })),
    preferences.hourCycle,
    visibilityFactor,
  );
  const weeklyRange = buildWeeklyRangeSeries(
    (weather?.daily ?? []).slice(7, 14).map((day) => ({
      ...day,
      temperatureMin: temperatureDisplay(day.temperatureMin, preferences.temperatureUnit),
      temperatureMax: temperatureDisplay(day.temperatureMax, preferences.temperatureUnit),
    })),
  );

  return (
    <main className="app-shell">
      {!weather || !currentDay || !currentSnapshot ? (
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
                <h1>Current weather</h1>
                <div className="sidebar-location-summary">
                  <strong>{weather.locationLabel}</strong>
                  <span>{weatherLabel(currentSnapshot.weatherCode)}</span>
                </div>
                {dataStatus && (
                  <p className="cache-status">
                    {dataStatus.source === "cached" ? "Showing cached conditions" : "Live weather updated"}{" "}
                    {formatSavedAtLabel(dataStatus.savedAt)}.
                  </p>
                )}
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
                  <div className="search-actions">
                    <button type="button" className="secondary-button compact-button" onClick={requestCurrentLocation}>
                      Locate
                    </button>
                    <button type="button" className="ghost-button compact-button" onClick={saveActiveLocation}>
                      Save
                    </button>
                  </div>
                </div>

                {showSearchFeedback && (
                  <div className="results-panel compact-results">
                    {searching ? (
                      <p className="muted">Searching...</p>
                    ) : results.length > 0 ? (
                      <select
                        className="search-results-select"
                        defaultValue=""
                        onChange={(event) => {
                          const option = results.find((entry) => entry.id === Number(event.target.value));
                          if (option) {
                            void loadWeather(option);
                            event.target.value = "";
                          }
                        }}
                      >
                        <option value="">Choose a matching location</option>
                        {results.map((option) => (
                          <option key={option.id} value={option.id}>
                            {[option.name, option.admin1, option.country].filter(Boolean).join(", ")}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <p className="muted search-empty-state">No matching locations yet. Try a nearby city or broader region.</p>
                    )}
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
                </div>

                {savedLocations.length === 0 ? (
                  <p className="muted">No saved places yet. Save a city to pin it here.</p>
                ) : (
                  <div className="saved-dropdown-row">
                    <select
                      className="saved-select"
                      value=""
                      onChange={(event) => {
                        const value = Number(event.target.value);
                        if (value) {
                          handleSavedLocationChange(value);
                          event.target.value = "";
                        }
                      }}
                    >
                      <option value="">Choose a saved place</option>
                      {savedLocations.map((location) => (
                        <option key={location.id} value={location.id}>
                          {[location.name, location.admin1, location.country].filter(Boolean).join(", ")}
                        </option>
                      ))}
                    </select>
                    {activeLocation && activeLocation.id !== 0 && savedLocations.some((location) => location.id === activeLocation.id) && (
                      <button
                        type="button"
                        className="saved-remove-button"
                        onClick={() => removeSavedLocation(activeLocation.id)}
                        aria-label={`Remove ${activeLocation.name}`}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div className="saved-panel">
                <div className="saved-header">
                  <div>
                    <p className="section-label">Preferences</p>
                    <h3>Display units</h3>
                  </div>
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => setPreferencesOpen((open) => !open)}
                    aria-expanded={preferencesOpen}
                  >
                    {preferencesOpen ? "Hide" : "Show"}
                  </button>
                </div>

                {preferencesOpen && (
                  <>
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
                  </>
                )}
              </div>
            </aside>

            <section className="overview-grid premium-grid primary-priority">
              <article className="primary-panel hero-conditions">
                <div className="hero-topline">
                  <div className="hero-heading">
                    <p className="section-label">{weather.locationLabel}</p>
                    <div className="hero-condition-row">
                      <span className="hero-condition-icon" aria-hidden="true">
                        {weatherIcon}
                      </span>
                      <div>
                        <h2>{weatherLabel(currentSnapshot.weatherCode)}</h2>
                        <p className="hero-supporting-copy">
                          Updated for {formatDayLabel(currentDay.date)} in {weather.timezone}.
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
                      <span className="temperature-unit">{temperatureUnitLabel}</span>
                    </div>
                    <div className="hero-pill-row">
                      <span className="hero-pill">
                        High / low{" "}
                        {temperatureDisplay(currentDay.temperatureMax, preferences.temperatureUnit)} /{" "}
                        {temperatureDisplay(currentDay.temperatureMin, preferences.temperatureUnit)} {temperatureUnitLabel}
                      </span>
                      <span className="hero-pill">
                        Rain {Math.round(currentSnapshot.precipitationProbability)}%
                      </span>
                    </div>
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
                          ^
                        </span>
                      </div>
                      <div className="wind-copy">
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
                  <Metric icon="PP" label="Rain chance" value={`${Math.round(currentSnapshot.precipitationProbability)}%`} />
                  <Metric icon="CC" label="Cloud cover" value={`${Math.round(currentSnapshot.cloudCover)}%`} />
                  <Metric
                    icon="VS"
                    label="Visibility"
                    value={`${visibilityDisplay(currentSnapshot.visibility / 1000, preferences.visibilityUnit)} ${visibilityUnitLabel}`}
                  />
                  <Metric icon="PR" label="Pressure" value={`${Math.round(currentSnapshot.pressure)} hPa`} />
                </div>
              </article>

              <article className="stat-panel insight-panel">
                <p className="section-label">Today summary</p>
                <h3>{formatDayLabel(currentDay.date)}</h3>
                <div className="insight-stack">
                  <div className="range-summary">
                    <div className="range-header">
                      <span>Hourly swing</span>
                      <strong>
                        {Math.round(Math.min(...hourlySeries.temperature.map((point) => point.value), 0))} to{" "}
                        {Math.round(Math.max(...hourlySeries.temperature.map((point) => point.value), 0))} {temperatureUnitLabel}
                      </strong>
                    </div>
                    <p className="muted">
                      {Math.round(currentDay.precipitationSum)} mm precipitation across {Math.round(currentDay.precipitationHours)} hours.
                    </p>
                  </div>
                  <div className="range-summary">
                    <div className="range-header">
                      <span>Wind ceiling</span>
                      <strong>
                        {windSpeedDisplay(currentDay.windSpeedMax, preferences.windUnit)} {windUnitLabel}
                      </strong>
                    </div>
                    <p className="muted">
                      Gusts can reach {windSpeedDisplay(currentDay.windGustsMax, preferences.windUnit)} {windUnitLabel}.
                    </p>
                  </div>
                  <div className="range-summary">
                    <div className="range-header">
                      <span>Visibility + cover</span>
                      <strong>
                        {visibilityDisplay(currentSnapshot.visibility / 1000, preferences.visibilityUnit)} {visibilityUnitLabel}
                      </strong>
                    </div>
                    <div className="progress-meter" aria-hidden="true">
                      <span style={{ width: `${Math.min(100, Math.max(8, currentSnapshot.cloudCover))}%` }} />
                    </div>
                    <p className="muted">Current cloud cover is {Math.round(currentSnapshot.cloudCover)}%.</p>
                  </div>
                </div>
              </article>

              <article className="stat-panel insight-panel compact-status-panel">
                <p className="section-label">Status</p>
                <h3>At a glance</h3>
                <div className="status-stack">
                  <div className="status-card">
                    <span>Alerts</span>
                    <strong>{weather.alerts.length}</strong>
                    <p className="muted">
                      {weather.alerts.length > 0 ? "Warnings are listed below." : "No severe alerts right now."}
                    </p>
                  </div>
                  <div className="status-card">
                    <span>Local time</span>
                    <strong>{formatTime(currentSnapshot.time, preferences.hourCycle)}</strong>
                    <p className="muted">Synced with {weather.timezone} timing.</p>
                  </div>
                  <div className="range-summary">
                    <div className="range-header">
                      <span>Pressure</span>
                      <strong>{Math.round(currentSnapshot.pressure)} hPa</strong>
                    </div>
                    <p className="muted">Surface pressure is steady in the live conditions view.</p>
                  </div>
                </div>
              </article>
            </section>
          </section>

          <section className="detail-switcher-panel">
            <div className="detail-switcher">
              <button
                type="button"
                className={detailView === "hourly" ? "detail-tab active" : "detail-tab"}
                onClick={() => setDetailView("hourly")}
              >
                Hourly
              </button>
              <button
                type="button"
                className={detailView === "weekly" ? "detail-tab active" : "detail-tab"}
                onClick={() => setDetailView("weekly")}
              >
                7 days
              </button>
              <button
                type="button"
                className={detailView === "alerts" ? "detail-tab active" : "detail-tab"}
                onClick={() => setDetailView("alerts")}
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
                                {temperatureDisplay(entry.temperature, preferences.temperatureUnit)} {temperatureUnitLabel}
                              </p>
                              <div className="mini-wind">
                                <span
                                  className="mini-wind-arrow"
                                  style={{ transform: `rotate(${entry.windDirection}deg)` }}
                                  aria-hidden="true"
                                >
                                  ^
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
                                <dd>
                                  {entry.precipitationAmount.toFixed(1)} mm / {Math.round(entry.precipitationProbability)}%
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
                    <WeeklyRangeChart points={weeklyRange} units={temperatureUnitLabel} />
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
                <p className="muted">Current conditions are ready. Loading hourly charts, the 14-day timeline, and alerts in the background.</p>
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
                  <AlertTimelineChart alerts={weather.alerts} hourCycle={preferences.hourCycle} />
                  <div className="alerts-grid">
                    {weather.alerts.map((alert) => (
                      <article key={alert.id} className="alert-card">
                        <p className="alert-chip">
                          {alert.severity} / {alert.urgency}
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
      )}
    </main>
  );
}

function Metric({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="metric-card">
      <span className="metric-icon" aria-hidden="true">
        {icon}
      </span>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function resolveCurrentSnapshot(hourlyForDay: WeatherSnapshot[], current: WeatherPayload["current"] | undefined) {
  if (!hourlyForDay.length) {
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

function buildWeatherFromOverview(overview: WeatherOverviewResponse): WeatherPayload {
  return {
    locationLabel: overview.locationLabel,
    timezone: overview.timezone,
    latitude: overview.latitude,
    longitude: overview.longitude,
    current: overview.current,
    hourly: [],
    daily: [overview.today],
    alerts: [],
  };
}

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

function readStoredOverview() {
  try {
    const raw = window.localStorage.getItem(LAST_OVERVIEW_KEY);
    return raw ? (JSON.parse(raw) as CachedOverview) : null;
  } catch {
    return null;
  }
}

function storeLocations(locations: LocationOption[]) {
  window.localStorage.setItem(SAVED_LOCATIONS_KEY, JSON.stringify(locations));
}

function storeLocation(key: string, location: LocationOption) {
  window.localStorage.setItem(key, JSON.stringify(location));
}

function storeOverview(location: LocationOption, overview: WeatherOverviewResponse) {
  const cachedOverview: CachedOverview = {
    savedAt: new Date().toISOString(),
    location,
    overview,
  };
  window.localStorage.setItem(LAST_OVERVIEW_KEY, JSON.stringify(cachedOverview));
}

function upsertLocation(locations: LocationOption[], nextLocation: LocationOption) {
  const existing = locations.filter((location) => location.id !== nextLocation.id);
  return [nextLocation, ...existing].slice(0, 6);
}

function weatherGlyph(weatherCode: number, isDay: boolean) {
  if (weatherCode === 0) {
    return isDay ? "☀" : "☾";
  }
  if ([1, 2].includes(weatherCode)) {
    return isDay ? "⛅" : "☁";
  }
  if ([3, 45, 48].includes(weatherCode)) {
    return "☁";
  }
  if ([51, 53, 55, 56, 57, 61, 63, 65, 80, 81, 82].includes(weatherCode)) {
    return "☂";
  }
  if ([66, 67, 71, 73, 75, 77, 85, 86].includes(weatherCode)) {
    return "❄";
  }
  if ([95, 96, 99].includes(weatherCode)) {
    return "⚡";
  }
  return "☁";
}

function formatSavedAtLabel(savedAt: string) {
  const deltaMinutes = Math.max(0, Math.round((Date.now() - new Date(savedAt).getTime()) / 60000));

  if (deltaMinutes < 1) {
    return "just now";
  }
  if (deltaMinutes < 60) {
    return `${deltaMinutes}m ago`;
  }

  const deltaHours = Math.round(deltaMinutes / 60);
  if (deltaHours < 24) {
    return `${deltaHours}h ago`;
  }

  const deltaDays = Math.round(deltaHours / 24);
  return `${deltaDays}d ago`;
}
