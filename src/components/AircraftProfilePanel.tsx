import {
  buildCustomAircraftProfile,
  type BatteryAge,
  type AircraftProfile,
} from "../lib/aircraftProfiles";

type AircraftProfilePanelProps = {
  aircraftProfile: AircraftProfile;
  aircraftProfilePresets: AircraftProfile[];
  onSelectPreset: (presetId: string) => void;
  onUpdateProfile: (profile: AircraftProfile) => void;
};

export function AircraftProfilePanel({
  aircraftProfile,
  aircraftProfilePresets,
  onSelectPreset,
  onUpdateProfile,
}: AircraftProfilePanelProps) {
  function updateNumberField(field: NumericAircraftField, value: string) {
    onUpdateProfile(buildCustomAircraftProfile({ ...aircraftProfile, [field]: Number(value) }));
  }

  function updateBatteryAge(batteryAge: BatteryAge) {
    onUpdateProfile(buildCustomAircraftProfile({ ...aircraftProfile, batteryAge }));
  }

  return (
    <div className="aircraft-profile-panel">
      <div className="aircraft-profile-header">
        <div>
          <p className="section-label">Aircraft Profile</p>
          <h3>{aircraftProfile.name}</h3>
        </div>
        <span className="aircraft-profile-badge">
          {aircraftProfile.reserveBatteryPct}% battery reserve
        </span>
      </div>

      <div className="aircraft-profile-control-row">
        <select
          id="aircraft-profile-select"
          aria-label="Aircraft type"
          value={aircraftProfile.id === "custom" ? "custom" : aircraftProfile.id}
          onChange={(event) => onSelectPreset(event.target.value)}
        >
          {aircraftProfilePresets.map((profile) => (
            <option key={profile.id} value={profile.id}>
              {profile.name}
            </option>
          ))}
          <option value="custom">Custom aircraft</option>
        </select>
      </div>

      <div className="aircraft-profile-grid">
        <NumberField
          label="Wind max"
          suffix="km/h"
          value={aircraftProfile.maxWindKmh}
          min={5}
          max={80}
          onChange={(value) => updateNumberField("maxWindKmh", value)}
        />
        <NumberField
          label="Gust max"
          suffix="km/h"
          value={aircraftProfile.maxGustKmh}
          min={8}
          max={100}
          onChange={(value) => updateNumberField("maxGustKmh", value)}
        />
        <NumberField
          label="Rain max"
          suffix="%"
          value={aircraftProfile.maxRainProbability}
          min={0}
          max={100}
          onChange={(value) => updateNumberField("maxRainProbability", value)}
        />
        <NumberField
          label="Temp min"
          suffix="C"
          value={aircraftProfile.minTempC}
          min={-30}
          max={20}
          onChange={(value) => updateNumberField("minTempC", value)}
        />
        <NumberField
          label="Temp max"
          suffix="C"
          value={aircraftProfile.maxTempC}
          min={20}
          max={55}
          onChange={(value) => updateNumberField("maxTempC", value)}
        />
        <NumberField
          label="Battery reserve"
          suffix="%"
          value={aircraftProfile.reserveBatteryPct}
          min={10}
          max={60}
          onChange={(value) => updateNumberField("reserveBatteryPct", value)}
        />
        <NumberField
          label="Payload"
          suffix="g"
          value={aircraftProfile.payloadGrams}
          min={0}
          max={5000}
          onChange={(value) => updateNumberField("payloadGrams", value)}
        />
        <label className="aircraft-profile-field">
          <span>Battery age</span>
          <select
            value={aircraftProfile.batteryAge}
            onChange={(event) => updateBatteryAge(event.target.value as BatteryAge)}
          >
            <option value="new">New</option>
            <option value="used">Used</option>
            <option value="aged">Aged</option>
          </select>
        </label>
      </div>
    </div>
  );
}

type NumericAircraftField =
  | "maxWindKmh"
  | "maxGustKmh"
  | "maxRainProbability"
  | "minTempC"
  | "maxTempC"
  | "reserveBatteryPct"
  | "payloadGrams";

function NumberField({
  label,
  max,
  min,
  onChange,
  suffix,
  value,
}: {
  label: string;
  max: number;
  min: number;
  onChange: (value: string) => void;
  suffix: string;
  value: number;
}) {
  return (
    <label className="aircraft-profile-field">
      <span>{label}</span>
      <span className="aircraft-profile-input-wrap">
        <input
          type="number"
          min={min}
          max={max}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        <small>{suffix}</small>
      </span>
    </label>
  );
}
