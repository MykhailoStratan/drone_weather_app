import React, { useEffect, useMemo, useRef, useState } from "react";
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
import { FlightReadinessPanel } from "./components/FlightReadinessPanel";
import { IconSunrise, IconSunset, IconRain, IconCloud, IconEye, IconGauge, IconCompass } from "./components/Icons";
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
import {
  fetchGnssEstimate,
  fetchWeatherAlerts,
  fetchWeatherOverview,
  fetchWeatherTimeline,
  searchLocations,
} from "./lib/weather";
import {
  readStoredLocations,
  readStoredLocation,
  readStoredPreferences,
  readStoredOverview,
  storeLocations,
  storeLocation,
  storeOverview,
  storePreferences,
  upsertLocation,
  buildWeatherFromOverview,
  defaultPreferences,
} from "./lib/storage";
import { resolveSelectedSnapshot, findNearestSnapshotIndex, weatherGlyph, formatSavedAtLabel } from "./lib/app-utils";
import type {
  GnssEnvironmentPreset,
  GnssEstimateResponse,
  LocationOption,
  WeatherPayload,
} from "./types";

const starterLocation: LocationOption = {
  id: 1,
  name: "Vancouver",
  admin1: "British Columbia",
  country: "Canada",
  latitude: 49.2497,
  longitude: -123.1193,
  timezone: "America/Vancouver",
};

const LAST_LOCATION_KEY = "skycanvas.lastLocation";

type Preferences = {
  theme: "dark" | "light";
  temperatureUnit: "c" | "f";
  windUnit: "kmh" | "mph";
  visibilityUnit: "km" | "mi";
  hourCycle: "12h" | "24h";
};

type DataStatus = {
  savedAt: string;
  source: "cached" | "live";
};

type DetailView = "hourly" | "weekly" | "alerts";

function App() {
  const [query, setQuery] = useState("Vancouver");
  const [results, setResults] = useState<LocationOption[]>([]);
  const [weather, setWeather] = useState<WeatherPayload | null>(null);
  const [activeLocation, setActiveLocation] = useState<LocationOption | null>(null);
  const [savedLocations, setSavedLocations] = useState<LocationOption[]>([]);
  const [preferences, setPreferences] = useState<Preferences>(defaultPreferences);
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedHourIndex, setSelectedHourIndex] = useState(-1);
  const [loading, setLoading] = useState(true);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [message, setMessage] = useState("");
  const [loadError, setLoadError] = useState<{ message: string; location: LocationOption } | null>(null);
  const [dataStatus, setDataStatus] = useState<DataStatus | null>(null);
  const [detailView, setDetailView] = useState<DetailView>("hourly");
  const [hourlyCardsOpen, setHourlyCardsOpen] = useState(false);
  const [environmentPreset, setEnvironmentPreset] = useState<GnssEnvironmentPreset>("open");
  const [gnssEstimate, setGnssEstimate] = useState<GnssEstimateResponse | null>(null);
  const [gnssLoading, setGnssLoading] = useState(false);
  const debounce = useRef<number | null>(null);
  const requestId = useRef(0);

  useEffect(() => {
    const storedLocations = readStoredLocations();
    const storedLocation = readStoredLocation(LAST_LOCATION_KEY);
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

    if (storedLocation) {
      void loadWeather(storedLocation);
    } else if (navigator.geolocation) {
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
          if (!cachedOverview) void loadWeather(starterLocation);
          setSearchOpen(true);
        },
        { enableHighAccuracy: true, timeout: 10000 },
      );
    } else {
      void loadWeather(starterLocation);
      setSearchOpen(true);
    }
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

  useEffect(() => {
    document.documentElement.dataset.theme = preferences.theme;
    document.documentElement.style.colorScheme = preferences.theme;
  }, [preferences.theme]);

  async function loadWeather(location: LocationOption) {
    const nextRequestId = requestId.current + 1;
    requestId.current = nextRequestId;
    setLoading(true);
    setDetailsLoading(true);
    setMessage("");
    setLoadError(null);

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
      setSelectedHourIndex(-1);
      setDetailView("hourly");
      setResults([]);
      setQuery(location.name);
      setActiveLocation(location);
      setGnssEstimate(null);
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
      if (requestId.current !== nextRequestId) return;

      const cachedFallback = readStoredOverview();
      if (cachedFallback) {
        setWeather(buildWeatherFromOverview(cachedFallback.overview));
        setSelectedDate(cachedFallback.overview.today.date);
        setActiveLocation(cachedFallback.location);
        setQuery(cachedFallback.location.name);
        setDataStatus({ savedAt: cachedFallback.savedAt, source: "cached" });
        setLoadError(null);
      } else {
        const message = error instanceof Error ? error.message : "Unable to load weather.";
        setLoadError({ message, location });
      }
      setLoading(false);
      setDetailsLoading(false);
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
        setSearchOpen(true);
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
    storePreferences(nextPreferences);
  }

  function handleSavedLocationChange(locationId: number) {
    const nextLocation = savedLocations.find((location) => location.id === locationId);
    if (nextLocation) {
      void loadWeather(nextLocation);
    }
  }

  const currentDay = useMemo(
    () => weather?.daily.find((day) => day.date === selectedDate) ?? weather?.daily[0],
    [weather?.daily, selectedDate],
  );
  const hourlyForDay = useMemo(
    () => weather?.hourly.filter((entry) => entry.time.startsWith(selectedDate)) ?? [],
    [weather?.hourly, selectedDate],
  );
  const hasTimeline = (weather?.daily.length ?? 0) > 1 && (weather?.hourly.length ?? 0) > 0;
  const hasAlerts = (weather?.alerts.length ?? 0) > 0;
  const showSearchFeedback = query.trim().length >= 2;
  const selectedSnapshot = useMemo(
    () => resolveSelectedSnapshot(hourlyForDay, selectedHourIndex, weather?.current),
    [hourlyForDay, selectedHourIndex, weather?.current],
  );
  const currentSnapshot = selectedSnapshot.snapshot;
  const activeHourIndex = selectedSnapshot.index;
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
  const activeHourSnapshot = hourlyForDay[activeHourIndex] ?? currentSnapshot;
  const activeHourLabel = activeHourSnapshot ? formatHourLabel(activeHourSnapshot.time, preferences.hourCycle) : "";
  const activeHourTimestamp = activeHourSnapshot ? formatTime(activeHourSnapshot.time, preferences.hourCycle) : "";

  useEffect(() => {
    if (!hourlyForDay.length) {
      setSelectedHourIndex(-1);
      return;
    }

    setSelectedHourIndex((currentIndex) => {
      if (currentIndex >= 0 && currentIndex < hourlyForDay.length) {
        return currentIndex;
      }

      return findNearestSnapshotIndex(hourlyForDay);
    });
  }, [hourlyForDay]);

  const gnssInput = useMemo(() => {
    if (!activeLocation || !currentSnapshot || !currentDay) return null;
    return {
      location: {
        latitude: activeLocation.latitude,
        longitude: activeLocation.longitude,
        timezone: activeLocation.timezone,
        name: activeLocation.name,
        admin1: activeLocation.admin1,
        country: activeLocation.country,
      },
      environment: environmentPreset,
      weather: {
        cloudCover: currentSnapshot.cloudCover,
        visibilityMeters: currentSnapshot.visibility,
        precipitationProbability: currentDay.precipitationProbabilityMax,
        precipitationSum: currentDay.precipitationSum,
        windGusts: currentDay.windGustsMax,
      },
    };
  }, [activeLocation, currentSnapshot, currentDay, environmentPreset]);

  useEffect(() => {
    if (!gnssInput) return;

    let cancelled = false;
    setGnssLoading(true);

    void fetchGnssEstimate(gnssInput)
      .then((response) => {
        if (!cancelled) setGnssEstimate(response);
      })
      .catch(() => {
        if (!cancelled) setGnssEstimate(null);
      })
      .finally(() => {
        if (!cancelled) setGnssLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [gnssInput]);

  return (
    <main className="app-shell">
      {loadError && !weather ? (
        <section className="loading-card error-card">
          <p className="error-card-message">{loadError.message}</p>
          <button
            type="button"
            className="secondary-button"
            onClick={() => void loadWeather(loadError.location)}
          >
            Retry
          </button>
          <button
            type="button"
            className="ghost-button"
            onClick={() => { setLoadError(null); setSearchOpen(true); }}
          >
            Search for a different location
          </button>
        </section>
      ) : !weather || !currentDay || !currentSnapshot ? (
        <section className="loading-card">
          <div className="spinner" />
          <p>Pulling the latest forecast and recent history...</p>
        </section>
      ) : (
        <>
          <div className="location-bar">
            <div className="location-bar-identity">
              <span className="location-bar-dot" />
              <span className="location-bar-brand">SkyCanvas · Weather</span>
            </div>
            <div className="location-bar-info">
              <span className="location-bar-name">{weather.locationLabel}</span>
              <span className="location-bar-sep" aria-hidden="true">·</span>
              <span className="location-bar-condition">{weatherLabel(currentSnapshot.weatherCode)}</span>
              {dataStatus && (
                <span className={`location-status-badge ${dataStatus.source}`}>
                  {dataStatus.source === "cached" ? "CACHED" : "LIVE"}
                </span>
              )}
            </div>
            <div className="location-bar-controls">
              <button
                type="button"
                className={searchOpen ? "bar-toggle-button active" : "bar-toggle-button"}
                onClick={() => setSearchOpen((o) => !o)}
                aria-expanded={searchOpen}
              >
                Search · Places
              </button>
              <button
                type="button"
                className={preferencesOpen ? "bar-toggle-button active" : "bar-toggle-button"}
                onClick={() => setPreferencesOpen((o) => !o)}
                aria-expanded={preferencesOpen}
              >
                {preferences.temperatureUnit === "f" ? "°F" : "°C"} · {preferences.windUnit === "mph" ? "mph" : "km/h"} · {preferences.hourCycle}
              </button>
            </div>
          </div>

          {(searchOpen || preferencesOpen) && (
            <div className="location-bar-panel">
              {searchOpen && (
                <div className="lbar-section lbar-search-section">
                  <div className="lbar-search-row">
                    <input
                      id="location-search"
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Vancouver, Seattle, Tokyo..."
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
                        <ul className="search-results-list">
                          {results.map((option) => (
                            <li key={option.id}>
                              <button
                                type="button"
                                className="search-result-item"
                                onClick={() => {
                                  void loadWeather(option);
                                  setSearchOpen(false);
                                }}
                              >
                                {[option.name, option.admin1, option.country].filter(Boolean).join(", ")}
                              </button>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="muted search-empty-state">No matches yet. Try a nearby city or broader region.</p>
                      )}
                    </div>
                  )}

                  {message && <p className="status-message">{message}</p>}

                  {savedLocations.length > 0 && (
                    <div className="lbar-saved-row">
                      <span className="section-label lbar-saved-label">Saved</span>
                      <div className="saved-dropdown-row">
                        <select
                          className="saved-select"
                          value=""
                          onChange={(event) => {
                            const value = Number(event.target.value);
                            if (value) {
                              handleSavedLocationChange(value);
                              event.target.value = "";
                              setSearchOpen(false);
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
                    </div>
                  )}
                </div>
              )}

              {preferencesOpen && (
                <div className="lbar-section lbar-prefs-section">
                  <div className="lbar-prefs-row">
                    <div className="lbar-pref-group">
                      <span className="preference-label">Theme</span>
                      <div className="segmented-control">
                        <button
                          type="button"
                          className={preferences.theme === "dark" ? "segment active" : "segment"}
                          onClick={() => updatePreferences({ ...preferences, theme: "dark" })}
                        >
                          Dark
                        </button>
                        <button
                          type="button"
                          className={preferences.theme === "light" ? "segment active" : "segment"}
                          onClick={() => updatePreferences({ ...preferences, theme: "light" })}
                        >
                          Light
                        </button>
                      </div>
                    </div>

                    <div className="lbar-pref-group">
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

                    <div className="lbar-pref-group">
                      <span className="preference-label">Wind & visibility</span>
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

                    <div className="lbar-pref-group">
                      <span className="preference-label">Clock</span>
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
                </div>
              )}
            </div>
          )}

          {dataStatus?.source === "cached" && (
            <div className="offline-banner" role="status">
              <span className="offline-banner-text">
                Showing cached data · {formatSavedAtLabel(dataStatus.savedAt)}
              </span>
              <button
                type="button"
                className="offline-banner-retry"
                onClick={() => activeLocation && void loadWeather(activeLocation)}
              >
                Retry
              </button>
            </div>
          )}

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
                          Updated for {formatDayLabel(currentDay.date)} · {weather.timezone}
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
                        H {temperatureDisplay(currentDay.temperatureMax, preferences.temperatureUnit)}° · L{" "}
                        {temperatureDisplay(currentDay.temperatureMin, preferences.temperatureUnit)}°
                      </span>
                      <span className="hero-pill">
                        Rain {Math.round(currentSnapshot.precipitationProbability)}%
                      </span>
                    </div>
                    {hourlyForDay.length > 0 && (
                      <div className="hero-hour-slider">
                        <div className="hero-hour-slider-header">
                          <div>
                            <span className="section-label">Hour scrubber</span>
                            <strong>{activeHourLabel}</strong>
                          </div>
                          <span className="hero-hour-slider-readout">{activeHourTimestamp}</span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={Math.max(hourlyForDay.length - 1, 0)}
                          step={1}
                          value={activeHourIndex}
                          onChange={(event) => setSelectedHourIndex(Number(event.target.value))}
                          aria-label="Select forecast hour"
                          aria-valuetext={activeHourLabel}
                        />
                        <div className="hero-hour-slider-scale" aria-hidden="true">
                          <span>{formatHourLabel(hourlyForDay[0].time, preferences.hourCycle)}</span>
                          <span>{formatHourLabel(hourlyForDay[Math.floor((hourlyForDay.length - 1) / 2)].time, preferences.hourCycle)}</span>
                          <span>{formatHourLabel(hourlyForDay[hourlyForDay.length - 1].time, preferences.hourCycle)}</span>
                        </div>
                      </div>
                    )}
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
                          {windDirectionLabel(currentSnapshot.windDirection)} · {Math.round(currentSnapshot.windDirection)}°
                        </strong>
                        <p>
                          {windSpeedDisplay(currentSnapshot.windSpeed, preferences.windUnit)} {windUnitLabel} sustained
                          <br />
                          gusts to {windSpeedDisplay(currentSnapshot.windGusts, preferences.windUnit)} {windUnitLabel}
                        </p>
                      </div>
                    </div>
                  </div>
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
                    environmentPreset={environmentPreset}
                    onEnvironmentChange={setEnvironmentPreset}
                    gnssEstimate={gnssEstimate}
                    loading={gnssLoading}
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
                            {Math.round(Math.min(...hourlySeries.temperature.map((point) => point.value), 0))}° →{" "}
                            {Math.round(Math.max(...hourlySeries.temperature.map((point) => point.value), 0))}°
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
                          <span>Visibility · cover</span>
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
              </article>
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
                            onClick={() => {
                              setSelectedDate(day.date);
                              const nextHourlyForDay = weather.hourly.filter((entry) => entry.time.startsWith(day.date));
                              setSelectedHourIndex(findNearestSnapshotIndex(nextHourlyForDay));
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
                                  {entry.precipitationAmount.toFixed(1)} mm · {Math.round(entry.precipitationProbability)}%
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
                  <AlertTimelineChart alerts={weather.alerts} hourCycle={preferences.hourCycle} />
                  <div className="alerts-grid">
                    {weather.alerts.map((alert) => (
                      <article key={alert.id} className="alert-card">
                        <p className="alert-chip">
                          {alert.severity} · {alert.urgency}
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

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="metric-card">
      <span className="metric-icon">{icon}</span>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export default App;
