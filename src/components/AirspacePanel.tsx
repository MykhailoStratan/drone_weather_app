import { useEffect, useRef } from "react";
import type { AirspaceFeature, AirspaceResponse } from "../types";

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
  advisory:   { fill: "rgba(245, 158, 63, 0.15)", stroke: "#f59e3f" },
  restricted: { fill: "rgba(77, 168, 218, 0.15)", stroke: "#4da8da" },
};

function bearingLabel(deg: number): string {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return dirs[Math.round(deg / 45) % 8];
}

function classificationLabel(cls: AirspaceFeature["classification"]): string {
  return cls === "controlled" ? "Controlled" : cls === "advisory" ? "Advisory" : "Restricted";
}

function AirspaceMap({
  latitude,
  longitude,
  features,
}: {
  latitude: number;
  longitude: number;
  features: AirspaceFeature[];
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
        zoom: 11,
        zoomControl: true,
        attributionControl: true,
      });

      mapRef.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 18,
      }).addTo(map);

      const locationIcon = L.divIcon({
        className: "",
        html: `<div class="airspace-location-dot"></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      });
      L.marker([latitude, longitude], { icon: locationIcon })
        .addTo(map)
        .bindPopup("Your location");

      for (const feature of features) {
        const colors = ZONE_COLORS[feature.classification];
        L.circle([feature.latitude, feature.longitude], {
          radius: feature.zoneRadiusKm * 1000,
          color: colors.stroke,
          fillColor: colors.fill,
          fillOpacity: 1,
          weight: 1.5,
        })
          .addTo(map)
          .bindPopup(
            `<strong>${feature.name}</strong><br>${classificationLabel(feature.classification)} airspace` +
              (feature.icao ? `<br>ICAO: ${feature.icao}` : "") +
              `<br>${feature.distanceKm.toFixed(1)} km away`,
          );

        const airportIcon = L.divIcon({
          className: "",
          html: `<div class="airspace-airport-dot ${feature.classification}"></div>`,
          iconSize: [10, 10],
          iconAnchor: [5, 5],
        });
        L.marker([feature.latitude, feature.longitude], { icon: airportIcon }).addTo(map);
      }
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

  let statusClass = "good";
  let statusText = "Uncontrolled airspace";

  if (withinZone) {
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
          />

          <div className="airspace-legend">
            <span className="airspace-legend-item controlled">Controlled</span>
            <span className="airspace-legend-item advisory">Advisory</span>
            <span className="airspace-legend-item restricted">Restricted</span>
          </div>

          {airspace.features.length === 0 ? (
            <p className="airspace-empty">No aerodromes found within 30 km.</p>
          ) : (
            <ul className="airspace-feature-list">
              {airspace.features.slice(0, 5).map((f) => (
                <li key={f.id} className="airspace-feature-row">
                  <div className={`airspace-dot ${f.classification}`} />
                  <div className="airspace-feature-info">
                    <strong>{f.name}</strong>
                    {f.icao && <span className="airspace-icao">{f.icao}</span>}
                  </div>
                  <div className="airspace-feature-distance">
                    <span>{f.distanceKm.toFixed(1)} km</span>
                    <span className="airspace-bearing">{bearingLabel(f.bearingDeg)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {withinZone && (
            <p className="airspace-advice">
              {withinZone.classification === "controlled"
                ? "Authorization required before flying. Check local regulations or use the LAANC system."
                : "Advisory zone — review local rules before flying."}
            </p>
          )}

          <p className="airspace-disclaimer">
            Airspace data from OpenStreetMap via Overpass API. Always verify with official sources before flight.
          </p>
        </>
      )}
    </div>
  );
}
