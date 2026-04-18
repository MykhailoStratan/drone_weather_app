import { useEffect, useRef, useState, type ReactNode } from "react";
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
import type {
  GnssEnvironmentPreset,
  GnssEstimateResponse,
  LocationOption,
  WeatherOverviewResponse,
  WeatherPayload,
  WeatherSnapshot,
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

// ── Inline SVG icons ──────────────────────────────────────────
// A tiny consistent icon set sized 16×16 with currentColor strokes.

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

const IconSunrise = () => (
  <Icon>
    <path d="M17 18a5 5 0 0 0-10 0" />
    <line x1="12" y1="2" x2="12" y2="9" />
    <line x1="4.22" y1="10.22" x2="5.64" y2="11.64" />
    <line x1="1" y1="18" x2="3" y2="18" />
    <line x1="21" y1="18" x2="23" y2="18" />
    <line x1="18.36" y1="11.64" x2="19.78" y2="10.22" />
    <line x1="23" y1="22" x2="1" y2="22" />
    <polyline points="8 6 12 2 16 6" />
  </Icon>
);

const IconSunset = () => (
  <Icon>
    <path d="M17 18a5 5 0 0 0-10 0" />
    <line x1="12" y1="9" x2="12" y2="2" />
    <line x1="4.22" y1="10.22" x2="5.64" y2="11.64" />
    <line x1="1" y1="18" x2="3" y2="18" />
    <line x1="21" y1="18" x2="23" y2="18" />
    <line x1="18.36" y1="11.64" x2="19.78" y2="10.22" />
    <line x1="23" y1="22" x2="1" y2="22" />
    <polyline points="16 5 12 9 8 5" />
  </Icon>
);

const IconRain = () => (
  <Icon>
    <line x1="8" y1="19" x2="8" y2="21" />
    <line x1="8" y1="13" x2="8" y2="15" />
    <line x1="16" y1="19" x2="16" y2="21" />
    <line x1="16" y1="13" x2="16" y2="15" />
    <line x1="12" y1="21" x2="12" y2="23" />
    <line x1="12" y1="15" x2="12" y2="17" />
    <path d="M20 16.58A5 5 0 0 0 18 7h-1.26A8 8 0 1 0 4 15.25" />
  </Icon>
);

const IconCloud = () => (
  <Icon>
    <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
  </Icon>
);

const IconEye = () => (
  <Icon>
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </Icon>
);

const IconGauge = () => (
  <Icon>
    <path d="M12 14l4-4" />
    <path d="M3.34 19a10 10 0 1 1 17.32 0" />
  </Icon>
);

const IconSun = () => (
  <Icon>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
  </Icon>
);

const IconPartlyCloudy = () => (
  <Icon>
    <circle cx="8" cy="8" r="3" />
    <path d="M8 2v1M2 8h1M3.5 3.5l.7.7M13 4.5l-.7.7" />
    <path d="M20 17.58A5 5 0 0 0 18 8h-.38" />
    <path d="M9.5 9A6 6 0 0 0 4 15a5 5 0 0 0 5 5h9" />
  </Icon>
);

const IconCloudDrizzle = () => (
  <Icon>
    <path d="M20 16.58A5 5 0 0 0 18 7h-1.26A8 8 0 1 0 4 15.25" />
    <line x1="8" y1="19" x2="8" y2="21" />
    <line x1="16" y1="19" x2="16" y2="21" />
    <line x1="12" y1="21" x2="12" y2="23" />
  </Icon>
);

const IconSnow = () => (
  <Icon>
    <path d="M20 17.58A5 5 0 0 0 18 8h-1.26A8 8 0 1 0 4 16.25" />
    <line x1="8" y1="16" x2="8.01" y2="16" />
    <line x1="8" y1="20" x2="8.01" y2="20" />
    <line x1="12" y1="18" x2="12.01" y2="18" />
    <line x1="12" y1="22" x2="12.01" y2="22" />
    <line x1="16" y1="16" x2="16.01" y2="16" />
    <line x1="16" y1="20" x2="16.01" y2="20" />
  </Icon>
);

const IconStorm = () => (
  <Icon>
    <path d="M19 16.9A5 5 0 0 0 18 7h-1.26a8 8 0 1 0-11.62 9" />
    <polyline points="13 11 9 17 15 17 11 23" />
  </Icon>
);

const IconMoon = () => (
  <Icon>
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </Icon>
);

// Compass-style wind marker (used in hour cards). Rotation is applied
// via the CSS transform on the parent span — this SVG is the glyph.
const IconCompass = () => (
  <Icon>
    <circle cx="12" cy="12" r="10" />
    <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
  </Icon>
);

function App() {
  const [query, setQuery] = useState("Vancouver");
  const [results, setResults] = useState<LocationOption[]>([]);
  const [weather, setWeather] = useState<WeatherPayload | null>(null);
  const [activeLocation, setActiveLocation] = useState<LocationOption | null>(null);
  const [savedLocations, setSavedLocations] = useState<LocationOption[]>([]);
  const [preferences, setPreferences] = useState<Preferences>(defaultPreferences);
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedHourIndex, setSelectedHourIndex] = useState(-1);
  const [loading, setLoading] = useState(true);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [message, setMessage] = useState("");
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
  const selectedSnapshot = resolveSelectedSnapshot(hourlyForDay, selectedHourIndex, weather?.current);
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

  useEffect(() => {
    if (!activeLocation || !currentSnapshot || !currentDay) {
      return;
    }

    let cancelled = false;
    setGnssLoading(true);

    void fetchGnssEstimate({
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
    })
      .then((response) => {
        if (!cancelled) {
          setGnssEstimate(response);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setGnssEstimate(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setGnssLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeLocation, currentDay, currentSnapshot, environmentPreset]);

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
                <p className="eyebrow">SkyCanvas · Weather</p>
                <h1>Current weather</h1>
                <div className="sidebar-location-summary">
                  <strong>{weather.locationLabel}</strong>
                  <span>{weatherLabel(currentSnapshot.weatherCode)}</span>
                </div>
                {dataStatus && (
                  <p className="cache-status">
                    {dataStatus.source === "cached" ? "CACHED" : "LIVE"} · UPDATED{" "}
                    {formatSavedAtLabel(dataStatus.savedAt)}
                  </p>
                )}
              </div>

              <div className="search-panel sidebar-search">
                <label className="search-label" htmlFor="location-search">
                  Search location
                </label>
                <div className="search-row sidebar-search-row">
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
                      <p className="muted search-empty-state">No matches yet. Try a nearby city or broader region.</p>
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

                    <div className="preference-group">
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

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="metric-card">
      <span className="metric-icon">{icon}</span>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function resolveSelectedSnapshot(hourlyForDay: WeatherSnapshot[], selectedHourIndex: number, current: WeatherPayload["current"] | undefined) {
  if (!hourlyForDay.length) {
    return { snapshot: current, index: 0 };
  }

  const index =
    selectedHourIndex >= 0 && selectedHourIndex < hourlyForDay.length
      ? selectedHourIndex
      : findNearestSnapshotIndex(hourlyForDay);

  return {
    snapshot: hourlyForDay[index],
    index,
  };
}

function findNearestSnapshotIndex(hourlyForDay: WeatherSnapshot[]) {
  if (!hourlyForDay.length) {
    return 0;
  }

  const now = Date.now();
  return hourlyForDay.reduce((closestIndex, entry, index) => {
    const distance = Math.abs(new Date(entry.time).getTime() - now);
    const closestDistance = Math.abs(new Date(hourlyForDay[closestIndex].time).getTime() - now);
    return distance < closestDistance ? index : closestIndex;
  }, 0);
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
    return isDay ? <IconSun /> : <IconMoon />;
  }
  if ([1, 2].includes(weatherCode)) {
    return <IconPartlyCloudy />;
  }
  if ([3, 45, 48].includes(weatherCode)) {
    return <IconCloud />;
  }
  if ([51, 53, 55, 56, 57].includes(weatherCode)) {
    return <IconCloudDrizzle />;
  }
  if ([61, 63, 65, 80, 81, 82].includes(weatherCode)) {
    return <IconRain />;
  }
  if ([66, 67, 71, 73, 75, 77, 85, 86].includes(weatherCode)) {
    return <IconSnow />;
  }
  if ([95, 96, 99].includes(weatherCode)) {
    return <IconStorm />;
  }
  return <IconCloud />;
}

function formatSavedAtLabel(savedAt: string) {
  const deltaMinutes = Math.max(0, Math.round((Date.now() - new Date(savedAt).getTime()) / 60000));

  if (deltaMinutes < 1) {
    return "JUST NOW";
  }
  if (deltaMinutes < 60) {
    return `${deltaMinutes}M AGO`;
  }

  const deltaHours = Math.round(deltaMinutes / 60);
  if (deltaHours < 24) {
    return `${deltaHours}H AGO`;
  }

  const deltaDays = Math.round(deltaHours / 24);
  return `${deltaDays}D AGO`;
}
