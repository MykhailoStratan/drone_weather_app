import type { Dispatch, RefObject, SetStateAction } from "react";
import type { LocationOption } from "../types";
import type { Preferences } from "../hooks/usePreferences";
import { IconSearch, IconSettings } from "./Icons";

type LocationBarProps = {
  activeLocation: LocationOption | null;
  dataStatus: { savedAt: string; source: "cached" | "live" } | null;
  loadError: { message: string; location: LocationOption } | null;
  locationBarName: string;
  message: string;
  preferences: Preferences;
  preferencesOpen: boolean;
  query: string;
  results: LocationOption[];
  savedLocations: LocationOption[];
  searchInputRef: RefObject<HTMLInputElement | null>;
  searchOpen: boolean;
  searching: boolean;
  setPreferencesOpen: Dispatch<SetStateAction<boolean>>;
  setQuery: (query: string) => void;
  setSearchOpen: Dispatch<SetStateAction<boolean>>;
  showSearchFeedback: boolean;
  updatePreferences: (preferences: Preferences) => void;
  onLoadWeather: (location: LocationOption) => void;
  onRequestCurrentLocation: () => void;
  onSaveActiveLocation: () => void;
  onSavedLocationChange: (locationId: number) => void;
  onRemoveSavedLocation: (locationId: number) => void;
};

function getCompactLocationName(locationName: string) {
  return locationName.split(",")[0]?.trim() || locationName;
}

export function LocationBar({
  activeLocation,
  dataStatus,
  loadError,
  locationBarName,
  message,
  onLoadWeather,
  onRemoveSavedLocation,
  onRequestCurrentLocation,
  onSaveActiveLocation,
  onSavedLocationChange,
  preferences,
  preferencesOpen,
  query,
  results,
  savedLocations,
  searchInputRef,
  searchOpen,
  searching,
  setPreferencesOpen,
  setQuery,
  setSearchOpen,
  showSearchFeedback,
  updatePreferences,
}: LocationBarProps) {
  const compactLocationName = getCompactLocationName(locationBarName);
  const preferenceSummary = `${preferences.temperatureUnit === "f" ? "Fahrenheit" : "Celsius"}, ${
    preferences.windUnit === "mph" ? "mph" : "km/h"
  }, ${preferences.hourCycle}`;

  return (
    <>
      <div className="location-bar">
        <div className="location-bar-info">
          <span className="location-bar-name">{compactLocationName}</span>
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
            onClick={() => setSearchOpen((open) => !open)}
            aria-expanded={searchOpen}
            aria-label="Search places"
            title="Search places"
          >
            <IconSearch />
          </button>
          <button
            type="button"
            className={preferencesOpen ? "bar-toggle-button active" : "bar-toggle-button"}
            onClick={() => setPreferencesOpen((open) => !open)}
            aria-expanded={preferencesOpen}
            aria-label="Preferences"
            title={`Preferences: ${preferenceSummary}`}
          >
            <IconSettings />
          </button>
        </div>
      </div>

      {(searchOpen || preferencesOpen || Boolean(loadError)) && (
        <div className="location-bar-panel">
          {(searchOpen || Boolean(loadError)) && (
            <div className="lbar-section lbar-search-section">
              <label className="search-label" htmlFor="location-search">
                Search location
              </label>
              <div className="lbar-search-row">
                <input
                  ref={searchInputRef}
                  id="location-search"
                  aria-label="Search location"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Vancouver, Seattle, Tokyo..."
                />
                <div className="search-actions">
                  <button type="button" className="secondary-button compact-button" onClick={onRequestCurrentLocation}>
                    Locate
                  </button>
                  <button type="button" className="ghost-button compact-button" onClick={onSaveActiveLocation}>
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
                              onLoadWeather(option);
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
                          onSavedLocationChange(value);
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
                        onClick={() => onRemoveSavedLocation(activeLocation.id)}
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
    </>
  );
}
