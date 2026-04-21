import { useEffect, useMemo, useState } from "react";
import { ForecastPanels } from "./components/ForecastPanels";
import { getHourScrubberVisibleSnapshots } from "./components/FlightWindowBar";
import { LocationBar } from "./components/LocationBar";
import { WeatherOverview } from "./components/WeatherOverview";
import { buildHourlySeries, buildWeeklyRangeSeries } from "./lib/chartUtils";
import { formatSavedAtLabel, resolveSelectedSnapshot, findNearestSnapshotIndex, weatherGlyph } from "./lib/app-utils";
import { formatDayLabel, temperatureDisplay, weatherLabel, windSpeedDisplay } from "./lib/format";
import { readStoredLocation, readStoredOverview } from "./lib/storage";
import { useAirspace } from "./hooks/useAirspace";
import { useLocationSearch } from "./hooks/useLocationSearch";
import { usePreferences } from "./hooks/usePreferences";
import { useWeatherData } from "./hooks/useWeatherData";
import type { LocationOption, WeatherPayload } from "./types";

function coordsToId(lat: number, lon: number): number {
  return Math.abs(Math.round(lat * 1000) * 10000 + Math.round(lon * 1000)) || 1;
}

function readLocationFromUrl(): LocationOption | null {
  const params = new URLSearchParams(window.location.search);
  const lat = parseFloat(params.get("lat") ?? "");
  const lon = parseFloat(params.get("lon") ?? "");
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return {
    id: coordsToId(lat, lon),
    name: params.get("name") ?? "Shared location",
    admin1: params.get("admin1") ?? undefined,
    country: params.get("country") ?? "Unknown",
    latitude: lat,
    longitude: lon,
    timezone: params.get("tz") ?? undefined,
  };
}

function writeLocationToUrl(location: LocationOption) {
  const params = new URLSearchParams();
  params.set("lat", location.latitude.toFixed(6));
  params.set("lon", location.longitude.toFixed(6));
  params.set("name", location.name);
  if (location.admin1) params.set("admin1", location.admin1);
  if (location.country) params.set("country", location.country);
  if (location.timezone) params.set("tz", location.timezone);
  window.history.replaceState(null, "", `?${params.toString()}`);
}

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

type DetailView = "hourly" | "weekly" | "alerts";

function App() {
  const [selectedHourIndex, setSelectedHourIndex] = useState(-1);
  const [detailView, setDetailView] = useState<DetailView>("hourly");
  const [hourlyCardsOpen, setHourlyCardsOpen] = useState(false);
  const { preferences, preferencesOpen, setPreferencesOpen, updatePreferences } = usePreferences();
  const {
    activeLocation,
    dataStatus,
    detailsLoading,
    loadError,
    loading,
    message,
    requestedLocation,
    selectedDate,
    setLoading,
    setMessage,
    setSelectedDate,
    weather,
    hydrateFromCachedOverview,
    loadWeather,
    retryRequestedLocation,
  } = useWeatherData({
    lastLocationKey: LAST_LOCATION_KEY,
  });
  const {
    query,
    results,
    savedLocations,
    searchInputRef,
    searchOpen,
    searching,
    focusSearchInput,
    handleSavedLocationChange,
    removeSavedLocation,
    requestCurrentLocation,
    saveActiveLocation,
    setQuery,
    setResults,
    setSearchOpen,
  } = useLocationSearch({
    loadWeather,
    activeLocation,
    setLoading,
    setMessage,
  });
  const { airspace, airspaceLoading } = useAirspace(activeLocation);

  useEffect(() => {
    const storedLocation = readStoredLocation(LAST_LOCATION_KEY);
    const cachedOverview = readStoredOverview();
    const urlLocation = readLocationFromUrl();

    if (cachedOverview) {
      hydrateFromCachedOverview(cachedOverview);
      setQuery(cachedOverview.location.name);
    }

    if (urlLocation) {
      void loadWeather(urlLocation);
    } else if (storedLocation) {
      void loadWeather(storedLocation);
    } else if (navigator.geolocation) {
      void requestCurrentLocation();
    } else {
      void loadWeather(starterLocation);
      setSearchOpen(true);
    }
  }, []);

  useEffect(() => {
    if (loadError) {
      setSearchOpen(true);
    }
  }, [loadError, setSearchOpen]);

  useEffect(() => {
    if (activeLocation) {
      writeLocationToUrl(activeLocation);
      setQuery(activeLocation.name);
      setSelectedHourIndex(-1);
      setDetailView("hourly");
    }
  }, [activeLocation]);

  const currentDay = useMemo(
    () => weather?.daily.find((day) => day.date === selectedDate) ?? weather?.daily[0],
    [weather?.daily, selectedDate],
  );
  const hourlyForDay = useMemo(
    () => weather?.hourly.filter((entry) => entry.time.startsWith(selectedDate)) ?? [],
    [weather?.hourly, selectedDate],
  );
  const nextDayHourly = useMemo(() => {
    if (!selectedDate || !weather) return [];
    const d = new Date(`${selectedDate}T00:00:00`);
    d.setDate(d.getDate() + 1);
    const nextDate = d.toISOString().slice(0, 10);
    return weather.hourly.filter((entry) => entry.time.startsWith(nextDate));
  }, [weather?.hourly, selectedDate]);
  const prevDayHourly = useMemo(() => {
    if (!selectedDate || !weather) return [];
    const d = new Date(`${selectedDate}T00:00:00`);
    d.setDate(d.getDate() - 1);
    const prevDate = d.toISOString().slice(0, 10);
    return weather.hourly.filter((entry) => entry.time.startsWith(prevDate));
  }, [weather?.hourly, selectedDate]);
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
  const hourlyTimelineWindow = useMemo(
    () => getHourScrubberVisibleSnapshots({ hourlyForDay, nextDayHourly, prevDayHourly }),
    [hourlyForDay, nextDayHourly, prevDayHourly],
  );
  const hourlyTimelineSeries = buildHourlySeries(
    hourlyTimelineWindow.map((entry) => ({
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
  const showWeatherLayout = Boolean(weather && currentDay && currentSnapshot);
  const locationBarName =
    weather?.locationLabel ??
    ([requestedLocation?.name, requestedLocation?.admin1, requestedLocation?.country].filter(Boolean).join(", ") || "Current weather");
  const locationBarCondition =
    showWeatherLayout && currentSnapshot
      ? weatherLabel(currentSnapshot.weatherCode)
      : loadError
        ? "Forecast unavailable"
        : "Loading forecast";
  const resolvedWeather = weather as WeatherPayload;
  const resolvedCurrentDay = currentDay as WeatherPayload["daily"][number];
  const resolvedCurrentSnapshot = currentSnapshot as WeatherPayload["current"];

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

  return (
    <main className="app-shell">
      {message && (
        <section className="status-banner" role="status">
          <div>
            <p className="section-label">Status update</p>
            <strong>{message}</strong>
          </div>
        </section>
      )}

      <LocationBar
        activeLocation={activeLocation}
        dataStatus={dataStatus}
        loadError={loadError}
        locationBarCondition={locationBarCondition}
        locationBarName={locationBarName}
        message={message}
        preferences={preferences}
        preferencesOpen={preferencesOpen}
        query={query}
        results={results}
        savedLocations={savedLocations}
        searchInputRef={searchInputRef}
        searchOpen={searchOpen || !showWeatherLayout}
        searching={searching}
        setPreferencesOpen={setPreferencesOpen}
        setQuery={setQuery}
        setSearchOpen={setSearchOpen}
        showSearchFeedback={showSearchFeedback}
        updatePreferences={updatePreferences}
        onLoadWeather={(location) => {
          setResults([]);
          void loadWeather(location);
        }}
        onRequestCurrentLocation={requestCurrentLocation}
        onSaveActiveLocation={saveActiveLocation}
        onSavedLocationChange={handleSavedLocationChange}
        onRemoveSavedLocation={removeSavedLocation}
      />

      {dataStatus?.source === "cached" && (
        <div className="offline-banner" role="status">
          <span className="offline-banner-text">
            Showing cached data - {formatSavedAtLabel(dataStatus.savedAt)}
          </span>
          <button
            type="button"
            className="offline-banner-retry"
            onClick={retryRequestedLocation}
          >
            Retry
          </button>
        </div>
      )}

      {showWeatherLayout ? (
        <>
          <WeatherOverview
            activeHourIndex={activeHourIndex}
            currentDay={resolvedCurrentDay}
            currentSnapshot={resolvedCurrentSnapshot}
            hourlyForDay={hourlyForDay}
            hourlyTemperature={hourlySeries.temperature}
            hourlyTimelineSeries={hourlyTimelineSeries}
            nextDayHourly={nextDayHourly}
            onHourChange={setSelectedHourIndex}
            onNextDayHourChange={(nextIndex) => {
              const nextDate = nextDayHourly[0]?.time.slice(0, 10);
              if (nextDate) {
                setSelectedDate(nextDate);
                setSelectedHourIndex(nextIndex);
              }
            }}
            onPrevDayHourChange={(prevIndex) => {
              const prevDate = prevDayHourly[0]?.time.slice(0, 10);
              if (prevDate) {
                setSelectedDate(prevDate);
                setSelectedHourIndex(prevIndex);
              }
            }}
            preferences={preferences}
            prevDayHourly={prevDayHourly}
            temperatureUnitLabel={temperatureUnitLabel}
            visibilityUnitLabel={visibilityUnitLabel}
            weather={resolvedWeather}
            weatherIcon={weatherIcon}
            windUnitLabel={windUnitLabel}
          />

          <ForecastPanels
            activeLocation={activeLocation}
            airspace={airspace}
            airspaceLoading={airspaceLoading}
            detailView={detailView}
            detailsLoading={detailsLoading}
            hasAlerts={hasAlerts}
            hasTimeline={hasTimeline}
            hourlyCardsOpen={hourlyCardsOpen}
            hourlyForDay={hourlyForDay}
            hourlySeries={hourlySeries}
            onDaySelect={(date, nextHourIndex) => {
              setSelectedDate(date);
              setSelectedHourIndex(nextHourIndex);
            }}
            onDetailViewChange={setDetailView}
            preferences={preferences}
            selectedDate={selectedDate}
            setHourlyCardsOpen={setHourlyCardsOpen}
            weeklyRange={weeklyRange}
            weather={resolvedWeather}
          />
        </>
      ) : loadError ? (
        <section className="loading-card error-card">
          <div className="error-card-copy">
            <p className="section-label">Overview failed</p>
            <h2>Forecast unavailable right now</h2>
            <p>{loadError.message}</p>
          </div>
          <div className="error-card-actions">
            <button type="button" className="secondary-button" onClick={retryRequestedLocation}>
              Retry
            </button>
            <button type="button" className="ghost-button" onClick={focusSearchInput}>
              Search for another location
            </button>
          </div>
        </section>
      ) : (
        <section className="loading-card">
          <div className="spinner" />
          <p>Pulling the latest forecast and recent history...</p>
        </section>
      )}
    </main>
  );
}

export default App;
