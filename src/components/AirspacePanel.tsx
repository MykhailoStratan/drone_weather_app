import { useEffect, useMemo, useRef, useState } from "react";
import type { AirspaceFeature, AirspaceResponse, TFRFeature } from "../types";

function patchLeafletIcons(L: typeof import("leaflet")) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  });
}

type ZoneStyle = { fill: string; stroke: string; weight?: number; dashArray?: string };

const ZONE_COLORS: Record<AirspaceFeature["classification"], ZoneStyle> = {
  controlled: { fill: "rgba(255, 90, 71, 0.18)", stroke: "#ff5a47", weight: 2 },
  advisory: { fill: "rgba(245, 158, 63, 0.18)", stroke: "#f59e3f", weight: 1.5, dashArray: "4 3" },
  restricted: { fill: "rgba(168, 85, 247, 0.20)", stroke: "#a855f7", weight: 2 },
  danger: { fill: "rgba(77, 168, 218, 0.18)", stroke: "#4da8da", weight: 2, dashArray: "6 3" },
  military: { fill: "rgba(129, 140, 248, 0.18)", stroke: "#818cf8", weight: 2, dashArray: "4 2" },
};

const FEATURE_TYPE_ICONS: Record<AirspaceFeature["featureType"], string> = {
  airport: "A",
  aerodrome: "A",
  helipad: "H",
  military: "M",
  restricted: "R",
  danger: "D",
  class_a: "A",
  class_b: "B",
  class_c: "C",
  class_d: "D",
  class_e: "E",
  class_f: "F",
  class_g: "G",
  ctr: "C",
  cya: "A",
  cyr: "R",
  cyd: "D",
  moa: "M",
  warning: "W",
  alert: "!",
  prohibited: "P",
};

const TFR_COLOR = { fill: "rgba(168, 85, 247, 0.12)", stroke: "#a855f7" };
const HIGH_ALTITUDE_LOWER_FT = 250_000;
const AIRSPACE_FILTER_ORDER = [
  "class_a",
  "class_b",
  "class_c",
  "class_d",
  "class_e",
  "class_f",
  "class_g",
  "ctr",
  "restricted",
  "danger",
  "military",
  "airport",
  "helipad",
  "advisory",
] as const;

type AirspaceFilterKey = (typeof AIRSPACE_FILTER_ORDER)[number];

const AIRSPACE_FILTER_LABELS: Record<AirspaceFilterKey, string> = {
  class_a: "Class A",
  class_b: "Class B",
  class_c: "Class C",
  class_d: "Class D",
  class_e: "Class E",
  class_f: "Class F",
  class_g: "Class G",
  ctr: "CTR",
  restricted: "Restricted",
  danger: "Danger",
  military: "Military",
  airport: "Airports",
  helipad: "Helipads",
  advisory: "Advisory",
};

const ICAO_FILTER_KEYS: Record<NonNullable<AirspaceFeature["icaoClass"]>, AirspaceFilterKey> = {
  A: "class_a",
  B: "class_b",
  C: "class_c",
  D: "class_d",
  E: "class_e",
  F: "class_f",
  G: "class_g",
};

const FEATURE_FILTER_KEYS: Partial<Record<AirspaceFeature["featureType"], AirspaceFilterKey>> = {
  class_a: "class_a",
  class_b: "class_b",
  class_c: "class_c",
  class_d: "class_d",
  class_e: "class_e",
  class_f: "class_f",
  class_g: "class_g",
  ctr: "ctr",
  restricted: "restricted",
  cyr: "restricted",
  prohibited: "restricted",
  danger: "danger",
  cyd: "danger",
  military: "military",
  moa: "military",
  warning: "military",
  airport: "airport",
  aerodrome: "airport",
  helipad: "helipad",
  cya: "advisory",
  alert: "advisory",
};

const FILTER_TONE_BY_KEY: Record<AirspaceFilterKey, AirspaceFeature["classification"] | "airport" | "tfr"> = {
  class_a: "controlled",
  class_b: "controlled",
  class_c: "controlled",
  class_d: "controlled",
  class_e: "advisory",
  class_f: "advisory",
  class_g: "advisory",
  ctr: "controlled",
  restricted: "restricted",
  danger: "danger",
  military: "military",
  airport: "airport",
  helipad: "advisory",
  advisory: "advisory",
};

const CLASS_FEATURE_TYPES = new Set<AirspaceFeature["featureType"]>([
  "class_a",
  "class_b",
  "class_c",
  "class_d",
  "class_e",
  "class_f",
  "class_g",
]);

function filterKeyForFeature(feature: AirspaceFeature): AirspaceFilterKey {
  if (feature.icaoClass) return ICAO_FILTER_KEYS[feature.icaoClass];
  const featureKey = FEATURE_FILTER_KEYS[feature.featureType];
  if (featureKey) return featureKey;
  if (feature.classification === "controlled") return "ctr";
  return feature.classification;
}

function isHighAltitudeFeature(feature: AirspaceFeature): boolean {
  return (feature.altitudeLowerFt ?? 0) >= HIGH_ALTITUDE_LOWER_FT;
}

function defaultFilterVisibility(): Record<AirspaceFilterKey, boolean> {
  return {
    class_a: true,
    class_b: true,
    class_c: true,
    class_d: true,
    class_e: true,
    class_f: true,
    class_g: true,
    ctr: true,
    restricted: true,
    danger: true,
    military: true,
    airport: true,
    helipad: true,
    advisory: true,
  };
}

function bearingLabel(deg: number): string {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return dirs[Math.round(deg / 45) % 8];
}

function classificationLabel(cls: AirspaceFeature["classification"]): string {
  return cls.charAt(0).toUpperCase() + cls.slice(1);
}

function featureTypeLabel(type: AirspaceFeature["featureType"]): string {
  const labels: Record<AirspaceFeature["featureType"], string> = {
    airport: "Airport",
    aerodrome: "Aerodrome",
    helipad: "Helipad",
    military: "Military Airfield",
    restricted: "Restricted Area",
    danger: "Danger Area",
    class_a: "Class A Airspace",
    class_b: "Class B Airspace",
    class_c: "Class C Airspace",
    class_d: "Class D Airspace",
    class_e: "Class E Airspace",
    class_f: "Class F Airspace",
    class_g: "Class G Airspace",
    ctr: "Control Zone (CTR)",
    cya: "Class F Advisory (CYA)",
    cyr: "Restricted Area (CYR)",
    cyd: "Danger Area (CYD)",
    moa: "Military Operations Area",
    warning: "Warning Area",
    alert: "Alert Area",
    prohibited: "Prohibited Area",
  };
  return labels[type];
}

function altitudeLabel(lower?: number, upper?: number): string {
  if (lower === undefined && upper === undefined) return "";
  const low = lower !== undefined ? `${lower.toLocaleString()} ft` : "SFC";
  const high = upper !== undefined ? `${upper.toLocaleString()} ft` : "UNL";
  return `${low} - ${high}`;
}

function formatTFRTime(iso?: string): string {
  if (!iso) return "Unknown";
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZoneName: "short",
    });
  } catch {
    return iso;
  }
}

type MapRefs = {
  map: import("leaflet").Map | null;
  layers: Record<string, import("leaflet").LayerGroup>;
  layerControl: import("leaflet").Control.Layers | null;
};

function layerKeyFor(classification: AirspaceFeature["classification"]): string {
  switch (classification) {
    case "controlled":
      return "Controlled";
    case "advisory":
      return "Advisory";
    case "restricted":
      return "Restricted / Prohibited";
    case "danger":
      return "Danger";
    case "military":
      return "Military";
  }
}

function buildFeaturePopupContent(feature: AirspaceFeature) {
  const wrapper = document.createElement("div");
  const title = document.createElement("strong");
  title.textContent = feature.name;
  wrapper.appendChild(title);
  wrapper.appendChild(document.createElement("br"));

  const type = document.createElement("span");
  type.style.opacity = "0.7";
  type.textContent = feature.icaoClass
    ? `${featureTypeLabel(feature.featureType)} · Class ${feature.icaoClass}`
    : featureTypeLabel(feature.featureType);
  wrapper.appendChild(type);
  wrapper.appendChild(document.createElement("br"));

  wrapper.append(`${classificationLabel(feature.classification)} airspace`);

  if (feature.icao) {
    wrapper.appendChild(document.createElement("br"));
    wrapper.append(`ICAO: ${feature.icao}`);
  }

  const altitude = altitudeLabel(feature.altitudeLowerFt, feature.altitudeUpperFt);
  if (altitude) {
    wrapper.appendChild(document.createElement("br"));
    wrapper.append(`Alt: ${altitude}`);
  }

  wrapper.appendChild(document.createElement("br"));
  wrapper.append(`${feature.distanceKm.toFixed(1)} km · ${bearingLabel(feature.bearingDeg)}`);

  wrapper.appendChild(document.createElement("br"));
  const source = document.createElement("span");
  source.style.opacity = "0.5";
  source.style.fontSize = "10px";
  source.textContent = `Source: ${feature.source}`;
  wrapper.appendChild(source);

  return wrapper;
}

function buildTfrPopupContent(tfr: TFRFeature) {
  const wrapper = document.createElement("div");
  const title = document.createElement("strong");
  title.textContent = `TFR ${tfr.notamNumber}`;
  wrapper.appendChild(title);
  wrapper.appendChild(document.createElement("br"));
  wrapper.append(`Radius: ${tfr.radiusNm.toFixed(1)} NM`);
  const altitude = altitudeLabel(tfr.altitudeLowerFt, tfr.altitudeUpperFt);
  if (altitude) {
    wrapper.appendChild(document.createElement("br"));
    wrapper.append(`Alt: ${altitude}`);
  }
  if (tfr.effectiveStart) {
    wrapper.appendChild(document.createElement("br"));
    wrapper.append(`From: ${formatTFRTime(tfr.effectiveStart)}`);
  }
  if (tfr.effectiveEnd) {
    wrapper.appendChild(document.createElement("br"));
    wrapper.append(`Until: ${formatTFRTime(tfr.effectiveEnd)}`);
  }
  wrapper.appendChild(document.createElement("br"));
  wrapper.append(`${tfr.distanceKm.toFixed(1)} km away`);
  return wrapper;
}

function AirspaceMap({
  latitude,
  longitude,
  features,
  tfrs,
}: {
  latitude: number;
  longitude: number;
  features: AirspaceFeature[];
  tfrs: TFRFeature[];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const refs = useRef<MapRefs>({ map: null, layers: {}, layerControl: null });

  useEffect(() => {
    if (!containerRef.current) return;
    const init = async () => {
      const mod = await import("leaflet");
      const L = mod.default ?? (mod as unknown as typeof import("leaflet"));
      if (!containerRef.current || refs.current.map) return;

      patchLeafletIcons(L);

      if (!document.getElementById("leaflet-css")) {
        const link = document.createElement("link");
        link.id = "leaflet-css";
        link.rel = "stylesheet";
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        document.head.appendChild(link);
      }

      const map = L.map(containerRef.current, {
        center: [latitude, longitude],
        zoom: 10,
        zoomControl: true,
        attributionControl: true,
      });
      refs.current.map = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 18,
      }).addTo(map);

      const locationIcon = L.divIcon({
        className: "",
        html: '<div class="airspace-location-dot"></div>',
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      });
      L.marker([latitude, longitude], { icon: locationIcon })
        .addTo(map)
        .bindPopup("Your location");

      const layerControl = L.control.layers(undefined, undefined, { collapsed: false }).addTo(map);
      refs.current.layerControl = layerControl;
      refs.current.layers = {};
    };

    void init();

    return () => {
      refs.current.map?.remove();
      refs.current = { map: null, layers: {}, layerControl: null };
    };
  }, [latitude, longitude]);

  useEffect(() => {
    const { map, layerControl } = refs.current;
    if (!map) return;

    void import("leaflet").then((mod) => {
      const L = mod.default ?? (mod as unknown as typeof import("leaflet"));

      for (const [key, layer] of Object.entries(refs.current.layers)) {
        layerControl?.removeLayer(layer);
        map.removeLayer(layer);
        delete refs.current.layers[key];
      }

      const ensureLayer = (key: string): import("leaflet").LayerGroup => {
        const existing = refs.current.layers[key];
        if (existing) return existing;
        const group = L.layerGroup();
        group.addTo(map);
        layerControl?.addOverlay(group, key);
        refs.current.layers[key] = group;
        return group;
      };

      const bounds: [number, number][] = [[latitude, longitude]];

      for (const feature of features) {
        const layerKey = layerKeyFor(feature.classification);
        const layer = ensureLayer(layerKey);
        const colors = ZONE_COLORS[feature.classification];
        const geometry = feature.geometry;

        if (geometry && (geometry.type === "Polygon" || geometry.type === "MultiPolygon")) {
          const leafletCoords =
            geometry.type === "Polygon"
              ? [geometry.coordinates.map((ring) => ring.map(([lng, lat]) => [lat, lng] as [number, number]))]
              : geometry.coordinates.map((polygon) =>
                  polygon.map((ring) => ring.map(([lng, lat]) => [lat, lng] as [number, number])),
                );
          const poly = L.polygon(leafletCoords as unknown as [number, number][][], {
            color: colors.stroke,
            fillColor: colors.fill,
            weight: colors.weight ?? 1.5,
            fillOpacity: 1,
            dashArray: colors.dashArray,
          })
            .addTo(layer)
            .bindPopup(buildFeaturePopupContent(feature));
          poly.getBounds().getNorthEast();
          const polyBounds = poly.getBounds();
          bounds.push([polyBounds.getNorth(), polyBounds.getEast()]);
          bounds.push([polyBounds.getSouth(), polyBounds.getWest()]);
        } else {
          L.circle([feature.latitude, feature.longitude], {
            radius: feature.zoneRadiusKm * 1000,
            color: colors.stroke,
            fillColor: colors.fill,
            weight: colors.weight ?? 1.5,
            fillOpacity: 1,
            dashArray: colors.dashArray,
          })
            .addTo(layer)
            .bindPopup(buildFeaturePopupContent(feature));
        }

        const icon = L.divIcon({
          className: "",
          html: `<div class="airspace-airport-dot ${feature.classification}" title="${feature.name}">${FEATURE_TYPE_ICONS[feature.featureType]}</div>`,
          iconSize: [16, 16],
          iconAnchor: [8, 8],
        });
        L.marker([feature.latitude, feature.longitude], { icon }).addTo(layer);
      }

      if (tfrs.length > 0) {
        const tfrLayer = ensureLayer("TFRs (US)");
        for (const tfr of tfrs) {
          const radiusM = Math.max(tfr.radiusNm * 1852, 1852);
          L.circle([tfr.latitude, tfr.longitude], {
            radius: radiusM,
            color: TFR_COLOR.stroke,
            fillColor: TFR_COLOR.fill,
            fillOpacity: 1,
            weight: 2,
            dashArray: "6 4",
          })
            .addTo(tfrLayer)
            .bindPopup(buildTfrPopupContent(tfr));

          const tfrIcon = L.divIcon({
            className: "",
            html: `<div class="airspace-airport-dot tfr" title="TFR ${tfr.notamNumber}">!</div>`,
            iconSize: [16, 16],
            iconAnchor: [8, 8],
          });
          L.marker([tfr.latitude, tfr.longitude], { icon: tfrIcon }).addTo(tfrLayer);
        }
      }

      if (bounds.length > 1) {
        map.fitBounds(bounds as unknown as import("leaflet").LatLngBoundsExpression, {
          padding: [16, 16],
          maxZoom: 12,
        });
      }
    });
  }, [features, tfrs, latitude, longitude]);

  return <div ref={containerRef} className="airspace-map-container" />;
}

function featureIsInside(feature: AirspaceFeature): boolean {
  if (!feature.geometry) return feature.distanceKm < feature.zoneRadiusKm;
  if (feature.geometry.type === "Point") return feature.distanceKm < feature.zoneRadiusKm;
  return feature.distanceKm <= 0.05;
}

export function AirspacePanel({
  latitude,
  longitude,
  airspace,
  loading,
}: {
  latitude?: number;
  longitude?: number;
  airspace: AirspaceResponse | null;
  loading: boolean;
}) {
  const features = airspace?.features ?? [];
  const tfrs = airspace?.tfrs ?? [];
  const [visibleFilters, setVisibleFilters] = useState(defaultFilterVisibility);
  const [showTfrs, setShowTfrs] = useState(true);
  const [showHighAltitude, setShowHighAltitude] = useState(false);
  const hasHighAltitudeFeatures = features.some(isHighAltitudeFeature);
  const visibleFeatures = useMemo(
    () =>
      features.filter(
        (feature) => visibleFilters[filterKeyForFeature(feature)] && (showHighAltitude || !isHighAltitudeFeature(feature)),
      ),
    [features, showHighAltitude, visibleFilters],
  );
  const visibleTfrs = showTfrs ? tfrs : [];
  const openAipFeatures = visibleFeatures.filter((feature) => feature.source === "openaip");
  const hasOpenAipSource =
    airspace?.dataSources.some((source) => source.toLowerCase().includes("openaip")) ?? false;

  const insideFeatures = visibleFeatures.filter(featureIsInside);
  const highestRisk = insideFeatures.find((f) => f.classification === "restricted")
    ?? insideFeatures.find((f) => f.classification === "danger")
    ?? insideFeatures.find((f) => f.classification === "military")
    ?? insideFeatures.find((f) => f.classification === "controlled")
    ?? insideFeatures.find((f) => f.classification === "advisory");
  const hasControlledNearby = visibleFeatures.some(
    (f) => f.classification === "controlled" && f.distanceKm < f.zoneRadiusKm + 5,
  );
  const activeTFRs = visibleTfrs.filter((tfr) => tfr.distanceKm < tfr.radiusNm * 1.852 + 10);

  let statusClass = "good";
  let statusText = "Uncontrolled airspace";

  if (loading) {
    statusClass = "loading";
    statusText = "Checking airspace...";
  } else if (activeTFRs.length > 0) {
    statusClass = "risk";
    statusText = `${activeTFRs.length} active TFR${activeTFRs.length > 1 ? "s" : ""} nearby`;
  } else if (highestRisk) {
    const cls = highestRisk.classification;
    if (cls === "restricted" || cls === "danger") {
      statusClass = "risk";
      statusText = `Within ${cls} airspace`;
    } else if (cls === "controlled" || cls === "military") {
      statusClass = "risk";
      statusText = `Within ${cls} airspace`;
    } else {
      statusClass = "caution";
      statusText = "Within advisory zone";
    }
  } else if (hasControlledNearby) {
    statusClass = "caution";
    statusText = "Controlled airspace nearby";
  }

  const mapLat = airspace?.latitude ?? latitude;
  const mapLng = airspace?.longitude ?? longitude;

  const presentFilters = new Set(features.map(filterKeyForFeature));
  const visibleClassifications = new Set(visibleFeatures.map((f) => f.classification));

  return (
    <div className="airspace-panel">
      <div className="airspace-panel-header">
        <p className="section-label">Airspace · restrictions</p>
        <span className={`airspace-status-badge ${statusClass}`}>{statusText}</span>
      </div>

      {mapLat !== undefined && mapLng !== undefined ? (
        <AirspaceMap latitude={mapLat} longitude={mapLng} features={visibleFeatures} tfrs={visibleTfrs} />
      ) : (
        <div className="airspace-loading">
          <div className="spinner spinner-sm" />
          <span>Waiting for location...</span>
        </div>
      )}

      {mapLat !== undefined && (
        <div className="airspace-filter-bar" aria-label="Airspace class filters">
          {AIRSPACE_FILTER_ORDER.filter((filterKey) => presentFilters.has(filterKey)).map((filterKey) => (
            <label key={filterKey} className={`airspace-class-toggle ${FILTER_TONE_BY_KEY[filterKey]}`}>
              <input
                type="checkbox"
                checked={visibleFilters[filterKey]}
                onChange={() => {
                  setVisibleFilters((current) => ({
                    ...current,
                    [filterKey]: !current[filterKey],
                  }));
                }}
              />
              <span>{AIRSPACE_FILTER_LABELS[filterKey]}</span>
            </label>
          ))}
          {tfrs.length > 0 && (
            <label className="airspace-class-toggle tfr">
              <input
                type="checkbox"
                checked={showTfrs}
                onChange={() => setShowTfrs((current) => !current)}
              />
              <span>TFR</span>
            </label>
          )}
          {hasHighAltitudeFeatures && (
            <label className="airspace-class-toggle high-altitude">
              <input
                type="checkbox"
                checked={showHighAltitude}
                onChange={() => setShowHighAltitude((current) => !current)}
              />
              <span>250k+ ft</span>
            </label>
          )}
        </div>
      )}

      {mapLat !== undefined && (
        <div className="airspace-legend">
          {visibleClassifications.has("controlled") && (
            <span className="airspace-legend-item controlled">Controlled</span>
          )}
          {visibleClassifications.has("advisory") && (
            <span className="airspace-legend-item advisory">Advisory</span>
          )}
          {visibleClassifications.has("restricted") && (
            <span className="airspace-legend-item restricted">Restricted</span>
          )}
          {visibleClassifications.has("danger") && (
            <span className="airspace-legend-item danger">Danger</span>
          )}
          {visibleClassifications.has("military") && (
            <span className="airspace-legend-item military">Military</span>
          )}
          {visibleTfrs.length > 0 && <span className="airspace-legend-item tfr">TFR</span>}
          {openAipFeatures.length > 0 && (
            <span className="airspace-legend-item openaip">OpenAIP</span>
          )}
        </div>
      )}

      {hasOpenAipSource && (
        <p className="airspace-source-status">
          OpenAIP:{" "}
          {openAipFeatures.length > 0
            ? `${openAipFeatures.length} mapped airspace ${openAipFeatures.length === 1 ? "feature" : "features"}`
            : "no mapped airspace features returned for this location"}
        </p>
      )}

      {airspace && visibleFeatures.length === 0 && visibleTfrs.length === 0 && (
        <p className="airspace-empty">No restrictions found within 30 km.</p>
      )}

      {visibleFeatures.length > 0 && (
        <ul className="airspace-feature-list">
          {visibleFeatures.slice(0, 6).map((feature) => (
            <li key={feature.id} className="airspace-feature-row">
              <div className={`airspace-dot ${feature.classification}`} />
              <div className="airspace-feature-info">
                <strong>{feature.name}</strong>
                <span className="airspace-icao">
                  {featureTypeLabel(feature.featureType)}
                  {feature.icaoClass && !CLASS_FEATURE_TYPES.has(feature.featureType) ? ` · Class ${feature.icaoClass}` : ""}
                  {feature.icao ? ` · ${feature.icao}` : ""}
                  {feature.source === "openaip" ? " · OpenAIP" : ""}
                </span>
                {(feature.altitudeLowerFt !== undefined || feature.altitudeUpperFt !== undefined) && (
                  <span className="airspace-altitude">
                    {altitudeLabel(feature.altitudeLowerFt, feature.altitudeUpperFt)}
                  </span>
                )}
              </div>
              <div className="airspace-feature-distance">
                <span>{feature.distanceKm.toFixed(1)} km</span>
                <span className="airspace-bearing">{bearingLabel(feature.bearingDeg)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}

      {activeTFRs.length > 0 && (
        <div className="airspace-tfr-section">
          <p className="airspace-tfr-heading">Active TFRs (US)</p>
          <ul className="airspace-feature-list">
            {activeTFRs.slice(0, 3).map((tfr) => (
              <li key={tfr.id} className="airspace-feature-row">
                <div className="airspace-dot tfr" />
                <div className="airspace-feature-info">
                  <strong>TFR {tfr.notamNumber}</strong>
                  <span className="airspace-icao">
                    {tfr.radiusNm.toFixed(1)} NM radius
                    {tfr.altitudeUpperFt ? ` · SFC-${tfr.altitudeUpperFt.toLocaleString()} ft` : ""}
                  </span>
                  {tfr.effectiveEnd && (
                    <span className="airspace-altitude">Until {formatTFRTime(tfr.effectiveEnd)}</span>
                  )}
                </div>
                <div className="airspace-feature-distance">
                  <span>{tfr.distanceKm.toFixed(1)} km</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {(highestRisk || activeTFRs.length > 0) && (
        <p className="airspace-advice">
          {activeTFRs.length > 0
            ? "Active TFR in your area - flight is prohibited without specific authorization."
            : highestRisk?.classification === "restricted" || highestRisk?.classification === "danger"
              ? "Restricted or danger airspace - flight is prohibited or requires specific authorization."
              : highestRisk?.classification === "controlled" || highestRisk?.classification === "military"
                ? "Authorization required before flying. Check local regulations or use LAANC (US) / NAV Drone (CA)."
                : "Advisory zone - review local rules before flying."}
        </p>
      )}

      {airspace && airspace.dataSources.length > 0 && (
        <p className="airspace-disclaimer">
          Sources: {airspace.dataSources.join(" · ")}. Always verify with official AIP/NOTAMs before flight.
        </p>
      )}
    </div>
  );
}
