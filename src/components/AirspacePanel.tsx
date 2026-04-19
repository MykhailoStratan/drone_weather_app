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
  controlled: { fill: "rgba(255, 90, 71, 0.15)", stroke: "#ff5a47" },
  advisory: { fill: "rgba(245, 158, 63, 0.15)", stroke: "#f59e3f" },
  restricted: { fill: "rgba(77, 168, 218, 0.15)", stroke: "#4da8da" },
};

const FEATURE_TYPE_ICONS: Record<AirspaceFeature["featureType"], string> = {
  airport: "A",
  aerodrome: "A",
  helipad: "H",
  military: "M",
  restricted: "R",
  danger: "D",
};

const TFR_COLOR = { fill: "rgba(168, 85, 247, 0.12)", stroke: "#a855f7" };

function bearingLabel(deg: number): string {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return dirs[Math.round(deg / 45) % 8];
}

function classificationLabel(cls: AirspaceFeature["classification"]): string {
  return cls === "controlled" ? "Controlled" : cls === "advisory" ? "Advisory" : "Restricted";
}

function featureTypeLabel(type: AirspaceFeature["featureType"]): string {
  const labels: Record<AirspaceFeature["featureType"], string> = {
    airport: "Airport",
    aerodrome: "Aerodrome",
    helipad: "Helipad",
    military: "Military Airfield",
    restricted: "Restricted Area",
    danger: "Danger Area",
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
  airspaceLayer: import("leaflet").LayerGroup | null;
  tfrLayer: import("leaflet").LayerGroup | null;
  layerControl: import("leaflet").Control.Layers | null;
};

function buildFeaturePopupContent(feature: AirspaceFeature) {
  const wrapper = document.createElement("div");

  const title = document.createElement("strong");
  title.textContent = feature.name;
  wrapper.appendChild(title);
  wrapper.appendChild(document.createElement("br"));

  const type = document.createElement("span");
  type.style.opacity = "0.7";
  type.textContent = featureTypeLabel(feature.featureType);
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
  const refs = useRef<MapRefs>({ map: null, airspaceLayer: null, tfrLayer: null, layerControl: null });

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
  }, [latitude, longitude]);

  useEffect(() => {
    const { map, airspaceLayer, tfrLayer, layerControl } = refs.current;
    if (!map || !airspaceLayer || !tfrLayer) return;

    void import("leaflet").then((mod) => {
      const L = mod.default ?? (mod as unknown as typeof import("leaflet"));

      airspaceLayer.clearLayers();
      tfrLayer.clearLayers();

      for (const feature of features) {
        const colors = ZONE_COLORS[feature.classification];

        L.circle([feature.latitude, feature.longitude], {
          radius: feature.zoneRadiusKm * 1000,
          color: colors.stroke,
          fillColor: colors.fill,
          fillOpacity: 1,
          weight: 1.5,
        })
          .addTo(airspaceLayer)
          .bindPopup(buildFeaturePopupContent(feature));

        const icon = L.divIcon({
          className: "",
          html: `<div class="airspace-airport-dot ${feature.classification}" title="${feature.name}">${FEATURE_TYPE_ICONS[feature.featureType]}</div>`,
          iconSize: [16, 16],
          iconAnchor: [8, 8],
        });
        L.marker([feature.latitude, feature.longitude], { icon }).addTo(airspaceLayer);
      }

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

      if (tfrs.length > 0 && !map.hasLayer(tfrLayer)) {
        tfrLayer.addTo(map);
        layerControl?.addOverlay(tfrLayer, "TFRs (US)");
      } else if (tfrs.length === 0 && map.hasLayer(tfrLayer)) {
        map.removeLayer(tfrLayer);
      }
    });
  }, [features, tfrs]);

  return <div ref={containerRef} className="airspace-map-container" />;
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

  const withinZone = features.find((feature) => feature.distanceKm < feature.zoneRadiusKm);
  const hasControlledNearby = features.some(
    (feature) => feature.classification === "controlled" && feature.distanceKm < feature.zoneRadiusKm + 5,
  );
  const activeTFRs = tfrs.filter((tfr) => tfr.distanceKm < tfr.radiusNm * 1.852 + 10);

  let statusClass = "good";
  let statusText = "Uncontrolled airspace";

  if (loading) {
    statusClass = "loading";
    statusText = "Checking airspace...";
  } else if (activeTFRs.length > 0) {
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

  const mapLat = airspace?.latitude ?? latitude;
  const mapLng = airspace?.longitude ?? longitude;

  return (
    <div className="airspace-panel">
      <div className="airspace-panel-header">
        <p className="section-label">Airspace · restrictions</p>
        <span className={`airspace-status-badge ${statusClass}`}>{statusText}</span>
      </div>

      {mapLat !== undefined && mapLng !== undefined ? (
        <AirspaceMap latitude={mapLat} longitude={mapLng} features={features} tfrs={tfrs} />
      ) : (
        <div className="airspace-loading">
          <div className="spinner spinner-sm" />
          <span>Waiting for location...</span>
        </div>
      )}

      {mapLat !== undefined && (
        <div className="airspace-legend">
          <span className="airspace-legend-item controlled">Controlled</span>
          <span className="airspace-legend-item advisory">Advisory</span>
          <span className="airspace-legend-item restricted">Restricted</span>
          {tfrs.length > 0 && <span className="airspace-legend-item tfr">TFR</span>}
        </div>
      )}

      {airspace && features.length === 0 && tfrs.length === 0 && (
        <p className="airspace-empty">No restrictions found within 30 km.</p>
      )}

      {features.length > 0 && (
        <ul className="airspace-feature-list">
          {features.slice(0, 5).map((feature) => (
            <li key={feature.id} className="airspace-feature-row">
              <div className={`airspace-dot ${feature.classification}`} />
              <div className="airspace-feature-info">
                <strong>{feature.name}</strong>
                <span className="airspace-icao">
                  {featureTypeLabel(feature.featureType)}
                  {feature.icao ? ` · ${feature.icao}` : ""}
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

      {(withinZone || activeTFRs.length > 0) && (
        <p className="airspace-advice">
          {activeTFRs.length > 0
            ? "Active TFR in your area - flight is prohibited without specific authorization."
            : withinZone?.classification === "controlled"
              ? "Authorization required before flying. Check local regulations or use the LAANC system."
              : "Advisory zone - review local rules before flying."}
        </p>
      )}

      {mapLat !== undefined && (
        <p className="airspace-disclaimer">
          Airspace: OpenStreetMap / Overpass API. TFRs: aviationweather.gov. Always verify with official sources before flight.
        </p>
      )}
    </div>
  );
}
