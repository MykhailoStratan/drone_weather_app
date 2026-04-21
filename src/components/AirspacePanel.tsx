import { useEffect, useRef } from "react";
import type { AirspaceFeature, AirspacePolygon, AirspaceResponse, TFRFeature } from "../types";

function patchLeafletIcons(L: typeof import("leaflet")) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  });
}

// Colors for ICAO classes (drone-relevant: A–E are most significant)
const ICAO_CLASS_COLORS: Record<string, { fill: string; stroke: string }> = {
  A: { fill: "rgba(255, 59, 48, 0.18)",  stroke: "#ff3b30" },
  B: { fill: "rgba(255, 90, 71, 0.16)",  stroke: "#ff5a47" },
  C: { fill: "rgba(255, 149, 0, 0.16)",  stroke: "#ff9500" },
  D: { fill: "rgba(245, 158, 63, 0.14)", stroke: "#f59e3f" },
  E: { fill: "rgba(255, 204, 0, 0.12)",  stroke: "#ffcc00" },
  F: { fill: "rgba(52, 199, 89, 0.10)",  stroke: "#34c759" },
  G: { fill: "rgba(77, 168, 218, 0.08)", stroke: "#4da8da" },
};

// Fallback colors for non-ICAO types (restricted/danger/prohibited)
const TYPE_COLORS: Record<string, { fill: string; stroke: string }> = {
  Restricted:  { fill: "rgba(77, 168, 218, 0.16)", stroke: "#4da8da" },
  Danger:      { fill: "rgba(255, 90, 71, 0.16)",  stroke: "#ff5a47" },
  Prohibited:  { fill: "rgba(175, 82, 222, 0.16)", stroke: "#af52de" },
  CTR:         { fill: "rgba(255, 90, 71, 0.14)",  stroke: "#ff5a47" },
  TMA:         { fill: "rgba(255, 149, 0, 0.12)",  stroke: "#ff9500" },
  default:     { fill: "rgba(100, 100, 200, 0.10)", stroke: "#6464c8" },
};

// Fallback colors for OSM point features
const ZONE_COLORS: Record<AirspaceFeature["classification"], { fill: string; stroke: string }> = {
  controlled: { fill: "rgba(255, 90, 71, 0.15)",  stroke: "#ff5a47" },
  advisory:   { fill: "rgba(245, 158, 63, 0.15)", stroke: "#f59e3f" },
  restricted: { fill: "rgba(77, 168, 218, 0.15)", stroke: "#4da8da" },
};

const FEATURE_TYPE_ICONS: Record<AirspaceFeature["featureType"], string> = {
  airport: "✈", aerodrome: "✈", helipad: "H",
  military: "★", restricted: "R", danger: "D",
};

const TFR_COLOR = { fill: "rgba(168, 85, 247, 0.12)", stroke: "#a855f7" };

function bearingLabel(deg: number): string {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return dirs[Math.round(deg / 45) % 8];
}

function classificationLabel(cls: AirspaceFeature["classification"]): string {
  return cls === "controlled" ? "Controlled" : cls === "advisory" ? "Advisory" : "Restricted";
}

function featureTypeLabel(t: AirspaceFeature["featureType"]): string {
  const labels: Record<AirspaceFeature["featureType"], string> = {
    airport: "Airport", aerodrome: "Aerodrome", helipad: "Helipad",
    military: "Military Airfield", restricted: "Restricted Area", danger: "Danger Area",
  };
  return labels[t];
}

function altitudeLabel(lower?: number, upper?: number): string {
  if (lower === undefined && upper === undefined) return "";
  const lo = lower !== undefined && lower > 0 ? `${lower.toLocaleString()} ft` : "SFC";
  const hi = upper !== undefined ? `${upper.toLocaleString()} ft` : "UNL";
  return `${lo} – ${hi}`;
}

function formatTFRTime(iso?: string): string {
  if (!iso) return "Unknown";
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit",
      timeZoneName: "short",
    });
  } catch { return iso; }
}

function polygonColors(p: AirspacePolygon): { fill: string; stroke: string } {
  if (p.icaoClass && ICAO_CLASS_COLORS[p.icaoClass]) return ICAO_CLASS_COLORS[p.icaoClass];
  return TYPE_COLORS[p.type] ?? TYPE_COLORS.default;
}

type MapRefs = {
  map: import("leaflet").Map | null;
  airspaceLayer: import("leaflet").LayerGroup | null;
  tfrLayer: import("leaflet").LayerGroup | null;
  layerControl: import("leaflet").Control.Layers | null;
};

function AirspaceMap({
  latitude, longitude, features, polygons, tfrs,
}: {
  latitude: number;
  longitude: number;
  features: AirspaceFeature[];
  polygons: AirspacePolygon[];
  tfrs: TFRFeature[];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const refs = useRef<MapRefs>({ map: null, airspaceLayer: null, tfrLayer: null, layerControl: null });

  // Initialize map once per location
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
        html: `<div class="airspace-location-dot"></div>`,
        iconSize: [16, 16], iconAnchor: [8, 8],
      });
      L.marker([latitude, longitude], { icon: locationIcon }).addTo(map).bindPopup("Your location");

      const airspaceLayer = L.layerGroup().addTo(map);
      const tfrLayer = L.layerGroup();
      refs.current.airspaceLayer = airspaceLayer;
      refs.current.tfrLayer = tfrLayer;

      const layerControl = L.control.layers(
        undefined,
        { "Airspace zones": airspaceLayer },
        { collapsed: false },
      ).addTo(map);
      refs.current.layerControl = layerControl;
    };

    void init();

    return () => {
      refs.current.map?.remove();
      refs.current = { map: null, airspaceLayer: null, tfrLayer: null, layerControl: null };
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latitude, longitude]);

  // Redraw zones whenever data changes
  useEffect(() => {
    const { map, airspaceLayer, tfrLayer, layerControl } = refs.current;
    if (!map || !airspaceLayer || !tfrLayer) return;

    import("leaflet").then((mod) => {
      const L = mod.default ?? (mod as unknown as typeof import("leaflet"));

      airspaceLayer.clearLayers();
      tfrLayer.clearLayers();

      // ── Real OpenAIP polygons ──────────────────────────────────────
      for (const poly of polygons) {
        const colors = polygonColors(poly);
        const alt = altitudeLabel(poly.altitudeLowerFt, poly.altitudeUpperFt);
        const classLabel = poly.icaoClass ? `Class ${poly.icaoClass}` : poly.classification;
        const popupHtml =
          `<strong>${poly.name}</strong>` +
          `<br><span style="opacity:.7">${poly.type}${poly.icaoClass ? ` · Class ${poly.icaoClass}` : ""}${poly.country ? ` · ${poly.country}` : ""}</span>` +
          `<br>${classLabel} airspace` +
          (alt ? `<br>Alt: ${alt}` : "");

        L.polygon(poly.polygon, {
          color: colors.stroke,
          fillColor: colors.fill,
          fillOpacity: 1,
          weight: 1.5,
          interactive: true,
        }).addTo(airspaceLayer).bindPopup(popupHtml);
      }

      // ── OSM point features (fallback when OpenAIP not configured) ──
      if (polygons.length === 0) {
        for (const feature of features) {
          const colors = ZONE_COLORS[feature.classification];
          const alt = altitudeLabel(feature.altitudeLowerFt, feature.altitudeUpperFt);
          const popupHtml =
            `<strong>${feature.name}</strong>` +
            `<br><span style="opacity:.7">${featureTypeLabel(feature.featureType)}</span>` +
            `<br>${classificationLabel(feature.classification)} airspace` +
            (feature.icao ? `<br>ICAO: <strong>${feature.icao}</strong>` : "") +
            (alt ? `<br>Alt: ${alt}` : "") +
            `<br>${feature.distanceKm.toFixed(1)} km · ${bearingLabel(feature.bearingDeg)}`;

          L.circle([feature.latitude, feature.longitude], {
            radius: feature.zoneRadiusKm * 1000,
            color: colors.stroke, fillColor: colors.fill,
            fillOpacity: 1, weight: 1.5,
          }).addTo(airspaceLayer).bindPopup(popupHtml);

          const icon = L.divIcon({
            className: "",
            html: `<div class="airspace-airport-dot ${feature.classification}" title="${feature.name}">${FEATURE_TYPE_ICONS[feature.featureType]}</div>`,
            iconSize: [16, 16], iconAnchor: [8, 8],
          });
          L.marker([feature.latitude, feature.longitude], { icon }).addTo(airspaceLayer);
        }
      }

      // ── TFRs ───────────────────────────────────────────────────────
      for (const tfr of tfrs) {
        const radiusM = Math.max(tfr.radiusNm * 1852, 1852);
        const alt = altitudeLabel(tfr.altitudeLowerFt, tfr.altitudeUpperFt);
        const popupHtml =
          `<strong>TFR ${tfr.notamNumber}</strong>` +
          `<br>Radius: ${tfr.radiusNm.toFixed(1)} NM` +
          (alt ? `<br>Alt: ${alt}` : "") +
          (tfr.effectiveStart ? `<br>From: ${formatTFRTime(tfr.effectiveStart)}` : "") +
          (tfr.effectiveEnd ? `<br>Until: ${formatTFRTime(tfr.effectiveEnd)}` : "") +
          `<br>${tfr.distanceKm.toFixed(1)} km away`;

        L.circle([tfr.latitude, tfr.longitude], {
          radius: radiusM, color: TFR_COLOR.stroke, fillColor: TFR_COLOR.fill,
          fillOpacity: 1, weight: 2, dashArray: "6 4",
        }).addTo(tfrLayer).bindPopup(popupHtml);

        const tfrIcon = L.divIcon({
          className: "",
          html: `<div class="airspace-airport-dot tfr" title="TFR ${tfr.notamNumber}">!</div>`,
          iconSize: [16, 16], iconAnchor: [8, 8],
        });
        L.marker([tfr.latitude, tfr.longitude], { icon: tfrIcon }).addTo(tfrLayer);
      }

      if (tfrs.length > 0 && !map.hasLayer(tfrLayer)) {
        tfrLayer.addTo(map);
        layerControl?.addOverlay(tfrLayer, "TFRs (US)");
      } else if (tfrs.length === 0 && map.hasLayer(tfrLayer)) {
        map.removeLayer(tfrLayer);
      }
    });
  }, [features, polygons, tfrs]);

  return <div ref={containerRef} className="airspace-map-container" />;
}

export function AirspacePanel({
  latitude, longitude, airspace, loading,
}: {
  latitude?: number;
  longitude?: number;
  airspace: AirspaceResponse | null;
  loading: boolean;
}) {
  const features = airspace?.features ?? [];
  const polygons = airspace?.polygons ?? [];
  const tfrs = airspace?.tfrs ?? [];
  const usingOpenAIP = airspace?.source === "openaip";

  const withinZone = features.find((f) => f.distanceKm < f.zoneRadiusKm);
  const hasControlledNearby = features.some(
    (f) => f.classification === "controlled" && f.distanceKm < f.zoneRadiusKm + 5,
  );
  const activeTFRs = tfrs.filter((t) => t.distanceKm < t.radiusNm * 1.852 + 10);

  // With OpenAIP polygons: check if user's location falls near any controlled/restricted polygon
  const nearRestrictedPoly = polygons.some(
    (p) => p.classification === "controlled" || p.classification === "restricted",
  );

  let statusClass = "good";
  let statusText = "Uncontrolled airspace";

  if (loading) {
    statusClass = "loading";
    statusText = "Checking airspace…";
  } else if (activeTFRs.length > 0) {
    statusClass = "risk";
    statusText = `${activeTFRs.length} active TFR${activeTFRs.length > 1 ? "s" : ""} nearby`;
  } else if (usingOpenAIP && nearRestrictedPoly) {
    statusClass = "caution";
    statusText = "Controlled/restricted airspace nearby";
  } else if (!usingOpenAIP && withinZone) {
    statusClass = withinZone.classification === "controlled" ? "risk" : "caution";
    statusText = withinZone.classification === "controlled"
      ? "Within controlled airspace" : "Within advisory zone";
  } else if (!usingOpenAIP && hasControlledNearby) {
    statusClass = "caution";
    statusText = "Controlled airspace nearby";
  }

  const mapLat = airspace?.latitude ?? latitude;
  const mapLng = airspace?.longitude ?? longitude;

  return (
    <div className="airspace-panel">
      <div className="airspace-panel-header">
        <p className="section-label">Airspace · restrictions</p>
        <span className={`airspace-status-badge ${statusClass}`}>{statusText}</span>
      </div>

      {mapLat !== undefined && mapLng !== undefined ? (
        <AirspaceMap
          latitude={mapLat}
          longitude={mapLng}
          features={features}
          polygons={polygons}
          tfrs={tfrs}
        />
      ) : (
        <div className="airspace-loading">
          <div className="spinner spinner-sm" />
          <span>Waiting for location…</span>
        </div>
      )}

      {mapLat !== undefined && (
        <>
          {usingOpenAIP ? (
            <div className="airspace-legend">
              <span className="airspace-legend-item icao-a">Class A/B</span>
              <span className="airspace-legend-item icao-c">Class C</span>
              <span className="airspace-legend-item icao-d">Class D/E</span>
              <span className="airspace-legend-item restricted">R/D/P</span>
              {tfrs.length > 0 && <span className="airspace-legend-item tfr">TFR</span>}
            </div>
          ) : (
            <div className="airspace-legend">
              <span className="airspace-legend-item controlled">Controlled</span>
              <span className="airspace-legend-item advisory">Advisory</span>
              <span className="airspace-legend-item restricted">Restricted</span>
              {tfrs.length > 0 && <span className="airspace-legend-item tfr">TFR</span>}
            </div>
          )}
        </>
      )}

      {airspace && polygons.length === 0 && features.length === 0 && tfrs.length === 0 && (
        <p className="airspace-empty">No restrictions found within range.</p>
      )}

      {/* OpenAIP polygon list */}
      {usingOpenAIP && polygons.length > 0 && (
        <ul className="airspace-feature-list">
          {polygons.slice(0, 6).map((p) => (
            <li key={p.id} className="airspace-feature-row">
              <div className={`airspace-dot ${p.classification}`} />
              <div className="airspace-feature-info">
                <strong>{p.name}</strong>
                <span className="airspace-icao">
                  {p.type}{p.icaoClass ? ` · Class ${p.icaoClass}` : ""}{p.country ? ` · ${p.country}` : ""}
                </span>
                {(p.altitudeLowerFt !== undefined || p.altitudeUpperFt !== undefined) && (
                  <span className="airspace-altitude">{altitudeLabel(p.altitudeLowerFt, p.altitudeUpperFt)}</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* OSM fallback feature list */}
      {!usingOpenAIP && features.length > 0 && (
        <ul className="airspace-feature-list">
          {features.slice(0, 5).map((f) => (
            <li key={f.id} className="airspace-feature-row">
              <div className={`airspace-dot ${f.classification}`} />
              <div className="airspace-feature-info">
                <strong>{f.name}</strong>
                <span className="airspace-icao">
                  {featureTypeLabel(f.featureType)}{f.icao ? ` · ${f.icao}` : ""}
                </span>
                {(f.altitudeLowerFt !== undefined || f.altitudeUpperFt !== undefined) && (
                  <span className="airspace-altitude">{altitudeLabel(f.altitudeLowerFt, f.altitudeUpperFt)}</span>
                )}
              </div>
              <div className="airspace-feature-distance">
                <span>{f.distanceKm.toFixed(1)} km</span>
                <span className="airspace-bearing">{bearingLabel(f.bearingDeg)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}

      {activeTFRs.length > 0 && (
        <div className="airspace-tfr-section">
          <p className="airspace-tfr-heading">Active TFRs (US)</p>
          <ul className="airspace-feature-list">
            {activeTFRs.slice(0, 3).map((t) => (
              <li key={t.id} className="airspace-feature-row">
                <div className="airspace-dot tfr" />
                <div className="airspace-feature-info">
                  <strong>TFR {t.notamNumber}</strong>
                  <span className="airspace-icao">
                    {t.radiusNm.toFixed(1)} NM radius
                    {t.altitudeUpperFt ? ` · SFC–${t.altitudeUpperFt.toLocaleString()} ft` : ""}
                  </span>
                  {t.effectiveEnd && (
                    <span className="airspace-altitude">Until {formatTFRTime(t.effectiveEnd)}</span>
                  )}
                </div>
                <div className="airspace-feature-distance">
                  <span>{t.distanceKm.toFixed(1)} km</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {activeTFRs.length > 0 && (
        <p className="airspace-advice">
          Active TFR in your area — flight is prohibited without specific authorization.
        </p>
      )}

      {mapLat !== undefined && (
        <p className="airspace-disclaimer">
          {usingOpenAIP
            ? "Airspace data from OpenAIP (openaip.net). TFRs: aviationweather.gov. Always verify with official sources before flight."
            : "Airspace: OpenStreetMap / Overpass API. TFRs: aviationweather.gov. Always verify with official sources before flight."}
        </p>
      )}
    </div>
  );
}
