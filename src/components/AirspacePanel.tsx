import { useEffect, useRef } from "react";
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

const ZONE_COLORS: Record<AirspaceFeature["classification"], { fill: string; stroke: string }> = {
  controlled: { fill: "rgba(255, 90, 71, 0.15)",  stroke: "#ff5a47" },
  advisory:   { fill: "rgba(245, 158, 63, 0.15)", stroke: "#f59e3f" },
  restricted: { fill: "rgba(77, 168, 218, 0.15)", stroke: "#4da8da" },
};

const FEATURE_TYPE_ICONS: Record<AirspaceFeature["featureType"], string> = {
  airport:    "✈",
  aerodrome:  "✈",
  helipad:    "H",
  military:   "★",
  restricted: "R",
  danger:     "D",
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
    airport: "Airport",
    aerodrome: "Aerodrome",
    helipad: "Helipad",
    military: "Military Airfield",
    restricted: "Restricted Area",
    danger: "Danger Area",
  };
  return labels[t];
}

function altitudeLabel(lower?: number, upper?: number): string {
  if (lower === undefined && upper === undefined) return "";
  const lo = lower !== undefined ? `${lower.toLocaleString()} ft` : "SFC";
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
  } catch {
    return iso;
  }
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
  const mapRef = useRef<import("leaflet").Map | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    let map: import("leaflet").Map | null = null;

    void import("leaflet").then((leafletModule) => {
      const L = leafletModule.default ?? (leafletModule as unknown as typeof import("leaflet"));

      if (!containerRef.current || mapRef.current) return;

      patchLeafletIcons(L);

      if (!document.getElementById("leaflet-css")) {
        const link = document.createElement("link");
        link.id = "leaflet-css";
        link.rel = "stylesheet";
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        document.head.appendChild(link);
      }

      map = L.map(containerRef.current, {
        center: [latitude, longitude],
        zoom: 10,
        zoomControl: true,
        attributionControl: true,
      });

      mapRef.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 18,
      }).addTo(map);

      // --- Airspace layer group ---
      const airspaceLayer = L.layerGroup();

      const locationIcon = L.divIcon({
        className: "",
        html: `<div class="airspace-location-dot"></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      });
      L.marker([latitude, longitude], { icon: locationIcon })
        .addTo(airspaceLayer)
        .bindPopup("Your location");

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
          color: colors.stroke,
          fillColor: colors.fill,
          fillOpacity: 1,
          weight: 1.5,
        })
          .addTo(airspaceLayer)
          .bindPopup(popupHtml);

        const icon = L.divIcon({
          className: "",
          html: `<div class="airspace-airport-dot ${feature.classification}" title="${feature.name}">${FEATURE_TYPE_ICONS[feature.featureType]}</div>`,
          iconSize: [16, 16],
          iconAnchor: [8, 8],
        });
        L.marker([feature.latitude, feature.longitude], { icon }).addTo(airspaceLayer);
      }

      airspaceLayer.addTo(map);

      // --- TFR layer group ---
      const tfrLayer = L.layerGroup();

      for (const tfr of tfrs) {
        const radiusM = tfr.radiusNm * 1852;
        const alt = altitudeLabel(tfr.altitudeLowerFt, tfr.altitudeUpperFt);
        const popupHtml =
          `<strong>TFR ${tfr.notamNumber}</strong>` +
          `<br>Radius: ${tfr.radiusNm.toFixed(1)} NM` +
          (alt ? `<br>Alt: ${alt}` : "") +
          (tfr.effectiveStart ? `<br>From: ${formatTFRTime(tfr.effectiveStart)}` : "") +
          (tfr.effectiveEnd ? `<br>Until: ${formatTFRTime(tfr.effectiveEnd)}` : "") +
          `<br>${tfr.distanceKm.toFixed(1)} km away`;

        L.circle([tfr.latitude, tfr.longitude], {
          radius: radiusM > 0 ? radiusM : 1852,
          color: TFR_COLOR.stroke,
          fillColor: TFR_COLOR.fill,
          fillOpacity: 1,
          weight: 2,
          dashArray: "6 4",
        })
          .addTo(tfrLayer)
          .bindPopup(popupHtml);

        const tfrIcon = L.divIcon({
          className: "",
          html: `<div class="airspace-airport-dot tfr" title="TFR ${tfr.notamNumber}">!</div>`,
          iconSize: [16, 16],
          iconAnchor: [8, 8],
        });
        L.marker([tfr.latitude, tfr.longitude], { icon: tfrIcon }).addTo(tfrLayer);
      }

      if (tfrs.length > 0) {
        tfrLayer.addTo(map);
      }

      // --- Layer control ---
      const overlays: Record<string, import("leaflet").LayerGroup> = {
        "Airspace zones": airspaceLayer,
      };
      if (tfrs.length > 0) {
        overlays["TFRs (US)"] = tfrLayer;
      }
      L.control.layers(undefined, overlays, { collapsed: false }).addTo(map);
    });

    return () => {
      map?.remove();
      mapRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latitude, longitude]);

  return <div ref={containerRef} className="airspace-map-container" />;
}

export function AirspacePanel({
  airspace,
  loading,
}: {
  airspace: AirspaceResponse | null;
  loading: boolean;
}) {
  const withinZone = airspace?.features.find((f) => f.distanceKm < f.zoneRadiusKm);
  const hasControlledNearby = airspace?.features.some(
    (f) => f.classification === "controlled" && f.distanceKm < f.zoneRadiusKm + 5,
  );
  const activeTFRs = airspace?.tfrs.filter(
    (t) => t.distanceKm < t.radiusNm * 1.852 + 10,
  ) ?? [];

  let statusClass = "good";
  let statusText = "Uncontrolled airspace";

  if (activeTFRs.length > 0) {
    statusClass = "risk";
    statusText = `${activeTFRs.length} active TFR${activeTFRs.length > 1 ? "s" : ""} nearby`;
  } else if (withinZone) {
    statusClass = withinZone.classification === "controlled" ? "risk" : "caution";
    statusText =
      withinZone.classification === "controlled" ? "Within controlled airspace" : "Within advisory zone";
  } else if (hasControlledNearby) {
    statusClass = "caution";
    statusText = "Controlled airspace nearby";
  }

  return (
    <div className="airspace-panel">
      <div className="airspace-panel-header">
        <p className="section-label">Airspace · overlay</p>
        <span className={`airspace-status-badge ${statusClass}`}>{statusText}</span>
      </div>

      {loading && !airspace && (
        <div className="airspace-loading">
          <div className="spinner spinner-sm" />
          <span>Loading airspace data…</span>
        </div>
      )}

      {airspace && (
        <>
          <AirspaceMap
            latitude={airspace.latitude}
            longitude={airspace.longitude}
            features={airspace.features}
            tfrs={airspace.tfrs}
          />

          <div className="airspace-legend">
            <span className="airspace-legend-item controlled">Controlled</span>
            <span className="airspace-legend-item advisory">Advisory</span>
            <span className="airspace-legend-item restricted">Restricted</span>
            {airspace.tfrs.length > 0 && (
              <span className="airspace-legend-item tfr">TFR</span>
            )}
          </div>

          {airspace.features.length === 0 && airspace.tfrs.length === 0 ? (
            <p className="airspace-empty">No restrictions found within 30 km.</p>
          ) : (
            <>
              {airspace.features.length > 0 && (
                <ul className="airspace-feature-list">
                  {airspace.features.slice(0, 5).map((f) => (
                    <li key={f.id} className="airspace-feature-row">
                      <div className={`airspace-dot ${f.classification}`} />
                      <div className="airspace-feature-info">
                        <strong>{f.name}</strong>
                        <span className="airspace-icao">
                          {featureTypeLabel(f.featureType)}
                          {f.icao ? ` · ${f.icao}` : ""}
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
            </>
          )}

          {(withinZone || activeTFRs.length > 0) && (
            <p className="airspace-advice">
              {activeTFRs.length > 0
                ? "Active TFR in your area — flight is prohibited without specific authorization."
                : withinZone?.classification === "controlled"
                ? "Authorization required before flying. Check local regulations or use the LAANC system."
                : "Advisory zone — review local rules before flying."}
            </p>
          )}

          <p className="airspace-disclaimer">
            Airspace: OpenStreetMap / Overpass API. TFRs: aviationweather.gov. Always verify with official sources before flight.
          </p>
        </>
      )}
    </div>
  );
}
