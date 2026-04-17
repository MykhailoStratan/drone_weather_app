import type { ReactNode } from "react";
import { curveMonotoneX } from "@visx/curve";
import { LinearGradient } from "@visx/gradient";
import { Group } from "@visx/group";
import { scaleBand, scaleLinear, scalePoint, scaleTime } from "@visx/scale";
import { AreaClosed, Bar, Line, LinePath } from "@visx/shape";
import { formatHourLabel, formatTime } from "../lib/format";
import type { DailyWeather, WeatherAlert } from "../types";

type HourlyDatum = {
  key: string;
  time: string;
  label: string;
  shortLabel: string;
  isDay?: boolean;
  value: number;
};

type PrecipDatum = HourlyDatum & {
  probability: number;
};

type WindDatum = HourlyDatum & {
  direction: number;
};

type DualDatum = HourlyDatum & {
  secondaryValue: number;
};

type RangeDatum = {
  key: string;
  label: string;
  shortLabel: string;
  min: number;
  max: number;
};

type ChartShellProps = {
  eyebrow: string;
  title: string;
  subtitle: string;
  footer?: ReactNode;
  children: ReactNode;
};

type ChartDimensions = {
  width: number;
  height: number;
  marginTop: number;
  marginRight: number;
  marginBottom: number;
  marginLeft: number;
};

type AlertTimelineChartProps = {
  alerts: WeatherAlert[];
  hourCycle: "12h" | "24h";
};

const baseDimensions: ChartDimensions = {
  width: 420,
  height: 176,
  marginTop: 16,
  marginRight: 16,
  marginBottom: 34,
  marginLeft: 16,
};

export function TemperatureCurveChart({
  points,
  units,
}: {
  points: HourlyDatum[];
  units: string;
}) {
  const { width, height, marginTop, marginRight, marginBottom, marginLeft } = baseDimensions;
  const innerHeight = height - marginTop - marginBottom;
  const x = scalePoint({
    domain: points.map((point) => point.key),
    range: [marginLeft, width - marginRight],
  });
  const y = scaleLinear({
    domain: createValueDomain(points.map((point) => point.value)),
    range: [height - marginBottom, marginTop],
  });
  const band = scaleBand({
    domain: points.map((point) => point.key),
    range: [marginLeft, width - marginRight],
    paddingInner: 0.18,
  });
  const [min, max] = summarizeRange(points.map((point) => point.value));

  return (
    <ChartShell
      eyebrow="Hourly arc"
      title="Temperature curve"
      subtitle={`${min} to ${max} ${units}`}
      footer={<AxisFooter labels={selectTickLabels(points.map((point) => point.shortLabel))} />}
    >
      <svg viewBox={`0 0 ${width} ${height}`} className="visx-chart" role="img" aria-label="Temperature curve">
        <LinearGradient id="temperature-fill" from="rgba(255, 213, 108, 0.5)" to="rgba(255, 126, 72, 0.06)" />
        {points.map((point) => {
          const xValue = band(point.key) ?? 0;
          const bandWidth = band.bandwidth();
          return (
            <rect
              key={`${point.key}-band`}
              x={xValue}
              y={marginTop}
              width={bandWidth}
              height={innerHeight}
              rx={10}
              fill={point.isDay ? "rgba(255, 213, 108, 0.08)" : "rgba(109, 134, 255, 0.08)"}
            />
          );
        })}
        <AreaClosed<HourlyDatum>
          data={points}
          x={(point) => x(point.key) ?? 0}
          y={(point) => y(point.value)}
          yScale={y}
          stroke="none"
          fill="url(#temperature-fill)"
          curve={curveMonotoneX}
        />
        <LinePath<HourlyDatum>
          data={points}
          x={(point) => x(point.key) ?? 0}
          y={(point) => y(point.value)}
          stroke="#ffd56c"
          strokeWidth={3}
          curve={curveMonotoneX}
        />
      </svg>
    </ChartShell>
  );
}

export function PrecipitationOverlayChart({
  points,
}: {
  points: PrecipDatum[];
}) {
  const { width, height, marginTop, marginRight, marginBottom, marginLeft } = baseDimensions;
  const x = scaleBand({
    domain: points.map((point) => point.key),
    range: [marginLeft, width - marginRight],
    paddingInner: 0.28,
  });
  const precipitationScale = scaleLinear({
    domain: [0, Math.max(1, ...points.map((point) => point.value))],
    range: [height - marginBottom, marginTop],
  });
  const probabilityScale = scaleLinear({
    domain: [0, 100],
    range: [height - marginBottom, marginTop],
  });
  const maxAmount = Math.max(...points.map((point) => point.value), 0);
  const maxProbability = Math.max(...points.map((point) => point.probability), 0);
  const subtitle =
    maxAmount < 0.1
      ? `Dry conditions, ${Math.round(maxProbability)}% chance`
      : `${maxAmount.toFixed(1)} mm peak, ${Math.round(maxProbability)}% chance`;

  return (
    <ChartShell
      eyebrow="Hourly rain"
      title="Precipitation + probability"
      subtitle={subtitle}
      footer={<AxisFooter labels={selectTickLabels(points.map((point) => point.shortLabel))} />}
    >
      <svg viewBox={`0 0 ${width} ${height}`} className="visx-chart" role="img" aria-label="Precipitation and probability chart">
        <LinearGradient id="precip-bars" from="rgba(141, 241, 211, 0.92)" to="rgba(90, 151, 255, 0.35)" />
        {points.map((point) => {
          const barX = x(point.key) ?? 0;
          const barWidth = x.bandwidth();
          const barY = precipitationScale(point.value);
          return (
            <Bar
              key={point.key}
              x={barX}
              y={barY}
              width={barWidth}
              height={height - marginBottom - barY}
              rx={8}
              fill="url(#precip-bars)"
            />
          );
        })}
        <LinePath<PrecipDatum>
          data={points}
          x={(point) => (x(point.key) ?? 0) + x.bandwidth() / 2}
          y={(point) => probabilityScale(point.probability)}
          stroke="#89d3ff"
          strokeWidth={2.5}
          curve={curveMonotoneX}
        />
      </svg>
    </ChartShell>
  );
}

export function WindDirectionChart({
  points,
  units,
}: {
  points: WindDatum[];
  units: string;
}) {
  const { width, height, marginTop, marginRight, marginBottom, marginLeft } = baseDimensions;
  const x = scaleBand({
    domain: points.map((point) => point.key),
    range: [marginLeft, width - marginRight],
    paddingInner: 0.28,
  });
  const y = scaleLinear({
    domain: [0, Math.max(1, ...points.map((point) => point.value))],
    range: [height - marginBottom, marginTop + 18],
  });
  const [min, max] = summarizeRange(points.map((point) => point.value));

  return (
    <ChartShell
      eyebrow="Wind field"
      title="Speed + direction"
      subtitle={`${min} to ${max} ${units}`}
      footer={<AxisFooter labels={selectTickLabels(points.map((point) => point.shortLabel))} />}
    >
      <svg viewBox={`0 0 ${width} ${height}`} className="visx-chart" role="img" aria-label="Wind speed and direction chart">
        {points.map((point, index) => {
          const barX = x(point.key) ?? 0;
          const barWidth = x.bandwidth();
          const barY = y(point.value);
          const centerX = barX + barWidth / 2;
          const markerY = Math.max(marginTop + 10, barY - 10);
          const vector = directionVector(point.direction, 10);
          const showMarker = index % 3 === 0 || index === points.length - 1;
          return (
            <Group key={point.key}>
              <Bar
                x={barX}
                y={barY}
                width={barWidth}
                height={height - marginBottom - barY}
                rx={8}
                fill="rgba(137, 211, 255, 0.8)"
              />
              {showMarker && (
                <>
                  <circle cx={centerX} cy={markerY} r={3} fill="#d8f2ff" />
                  <Line
                    from={{ x: centerX, y: markerY }}
                    to={{ x: centerX + vector.x, y: markerY + vector.y }}
                    stroke="#d8f2ff"
                    strokeWidth={2}
                    strokeLinecap="round"
                  />
                  <polygon
                    points={arrowHeadPoints(centerX + vector.x, markerY + vector.y, point.direction)}
                    fill="#d8f2ff"
                  />
                </>
              )}
            </Group>
          );
        })}
      </svg>
    </ChartShell>
  );
}

export function WeeklyRangeChart({
  points,
  units,
}: {
  points: RangeDatum[];
  units: string;
}) {
  const width = 980;
  const height = 176;
  const marginTop = 14;
  const marginRight = 28;
  const marginBottom = 34;
  const marginLeft = 28;
  const x = scalePoint({
    domain: points.map((point) => point.key),
    range: [marginLeft + 18, width - marginRight - 18],
  });
  const y = scaleLinear({
    domain: createValueDomain(points.flatMap((point) => [point.min, point.max])),
    range: [height - marginBottom, marginTop],
  });
  const minValue = Math.min(...points.map((point) => point.min));
  const maxValue = Math.max(...points.map((point) => point.max));

  return (
    <ChartShell
      eyebrow="Next seven days"
      title="Min/max temperature range"
      subtitle={`${Math.round(minValue)} to ${Math.round(maxValue)} ${units}`}
      footer={<AxisFooter labels={points.map((point) => point.shortLabel)} dense />}
    >
      <svg viewBox={`0 0 ${width} ${height}`} className="visx-chart visx-chart-large" role="img" aria-label="Seven day temperature range chart">
        {points.map((point) => {
          const cx = x(point.key) ?? 0;
          const yMin = y(point.min);
          const yMax = y(point.max);
          return (
            <Group key={point.key}>
              <Line from={{ x: cx, y: yMax }} to={{ x: cx, y: yMin }} stroke="rgba(255, 255, 255, 0.24)" strokeWidth={8} strokeLinecap="round" />
              <circle cx={cx} cy={yMax} r={6} fill="#ffd56c" />
              <circle cx={cx} cy={yMin} r={6} fill="#89d3ff" />
            </Group>
          );
        })}
      </svg>
    </ChartShell>
  );
}

export function DaylightBandChart({
  sunrise,
  sunset,
  hourCycle,
}: {
  sunrise: string;
  sunset: string;
  hourCycle: "12h" | "24h";
}) {
  const width = 420;
  const height = 84;
  const margin = 16;
  const scale = scaleLinear({
    domain: [0, 24],
    range: [margin, width - margin],
  });
  const sunriseHour = extractHourValue(sunrise);
  const sunsetHour = extractHourValue(sunset);

  return (
    <ChartShell
      eyebrow="Solar window"
      title="Sunrise / sunset"
      subtitle={`${formatTime(sunrise, hourCycle)} to ${formatTime(sunset, hourCycle)}`}
    >
      <svg viewBox={`0 0 ${width} ${height}`} className="visx-chart visx-chart-daylight" role="img" aria-label="Sunrise and sunset daylight band">
        <rect x={margin} y={26} width={width - margin * 2} height={24} rx={12} fill="rgba(109, 134, 255, 0.18)" />
        <rect
          x={scale(sunriseHour)}
          y={26}
          width={Math.max(8, scale(sunsetHour) - scale(sunriseHour))}
          height={24}
          rx={12}
          fill="rgba(255, 213, 108, 0.9)"
        />
      </svg>
      <div className="daylight-labels">
        <span>12:00 AM</span>
        <span>{formatTime(sunrise, hourCycle)}</span>
        <span>{formatTime(sunset, hourCycle)}</span>
        <span>11:59 PM</span>
      </div>
    </ChartShell>
  );
}

export function PressureTrendChart({
  points,
}: {
  points: HourlyDatum[];
}) {
  const { width, height, marginTop, marginRight, marginBottom, marginLeft } = baseDimensions;
  const x = scalePoint({
    domain: points.map((point) => point.key),
    range: [marginLeft, width - marginRight],
  });
  const y = scaleLinear({
    domain: createValueDomain(points.map((point) => point.value), 4),
    range: [height - marginBottom, marginTop],
  });
  const [min, max] = summarizeRange(points.map((point) => point.value));

  return (
    <ChartShell
      eyebrow="Pressure"
      title="Trend through the day"
      subtitle={`${min} to ${max} hPa`}
      footer={<AxisFooter labels={selectTickLabels(points.map((point) => point.shortLabel))} />}
    >
      <svg viewBox={`0 0 ${width} ${height}`} className="visx-chart" role="img" aria-label="Pressure trend chart">
        <LinearGradient id="pressure-fill" from="rgba(137, 211, 255, 0.35)" to="rgba(137, 211, 255, 0.04)" />
        <AreaClosed<HourlyDatum>
          data={points}
          x={(point) => x(point.key) ?? 0}
          y={(point) => y(point.value)}
          yScale={y}
          stroke="none"
          fill="url(#pressure-fill)"
          curve={curveMonotoneX}
        />
        <LinePath<HourlyDatum>
          data={points}
          x={(point) => x(point.key) ?? 0}
          y={(point) => y(point.value)}
          stroke="#89d3ff"
          strokeWidth={2.5}
          curve={curveMonotoneX}
        />
      </svg>
    </ChartShell>
  );
}

export function CloudVisibilityChart({
  points,
  visibilityUnits,
}: {
  points: DualDatum[];
  visibilityUnits: string;
}) {
  const { width, height, marginTop, marginRight, marginBottom, marginLeft } = baseDimensions;
  const x = scalePoint({
    domain: points.map((point) => point.key),
    range: [marginLeft, width - marginRight],
  });
  const cloudScale = scaleLinear({
    domain: [0, 100],
    range: [height - marginBottom, marginTop],
  });
  const visibilityScale = scaleLinear({
    domain: [0, Math.max(1, ...points.map((point) => point.secondaryValue))],
    range: [height - marginBottom, marginTop],
  });
  const visibilityMax = Math.max(...points.map((point) => point.secondaryValue), 0);

  return (
    <ChartShell
      eyebrow="Sky clarity"
      title="Cloud cover + visibility"
      subtitle={`${Math.round(Math.max(...points.map((point) => point.value), 0))}% clouds, ${visibilityMax.toFixed(1)} ${visibilityUnits} visibility`}
      footer={<AxisFooter labels={selectTickLabels(points.map((point) => point.shortLabel))} />}
    >
      <svg viewBox={`0 0 ${width} ${height}`} className="visx-chart" role="img" aria-label="Cloud cover and visibility chart">
        <AreaClosed<DualDatum>
          data={points}
          x={(point) => x(point.key) ?? 0}
          y={(point) => cloudScale(point.value)}
          yScale={cloudScale}
          stroke="none"
          fill="rgba(255, 213, 108, 0.18)"
          curve={curveMonotoneX}
        />
        <LinePath<DualDatum>
          data={points}
          x={(point) => x(point.key) ?? 0}
          y={(point) => cloudScale(point.value)}
          stroke="#ffd56c"
          strokeWidth={2.5}
          curve={curveMonotoneX}
        />
        <LinePath<DualDatum>
          data={points}
          x={(point) => x(point.key) ?? 0}
          y={(point) => visibilityScale(point.secondaryValue)}
          stroke="#89d3ff"
          strokeWidth={2.5}
          curve={curveMonotoneX}
        />
      </svg>
    </ChartShell>
  );
}

export function AlertTimelineChart({ alerts, hourCycle }: AlertTimelineChartProps) {
  const timedAlerts = alerts.filter((alert) => alert.startsAt && alert.endsAt);

  if (!timedAlerts.length) {
    return (
      <ChartShell eyebrow="Alert timing" title="Active severe weather window" subtitle="Timing unavailable from the upstream alert feed">
        <div className="chart-empty-state">Active alerts exist, but this feed did not include exact start and end times.</div>
      </ChartShell>
    );
  }

  const width = 420;
  const rowHeight = 32;
  const height = 34 + timedAlerts.length * rowHeight;
  const marginLeft = 16;
  const marginRight = 16;
  const startTimes = timedAlerts.map((alert) => new Date(alert.startsAt as string));
  const endTimes = timedAlerts.map((alert) => new Date(alert.endsAt as string));
  const min = new Date(Math.min(...startTimes.map((value) => value.getTime())));
  const max = new Date(Math.max(...endTimes.map((value) => value.getTime())));
  const x = scaleTime({
    domain: [min, max.getTime() === min.getTime() ? new Date(min.getTime() + 6 * 60 * 60 * 1000) : max],
    range: [marginLeft, width - marginRight],
  });

  return (
    <ChartShell
      eyebrow="Alert timing"
      title="Active severe weather window"
      subtitle={`${formatTime(min.toISOString(), hourCycle)} to ${formatTime(max.toISOString(), hourCycle)}`}
    >
      <svg viewBox={`0 0 ${width} ${height}`} className="visx-chart visx-chart-alerts" role="img" aria-label="Severe alert timeline">
        {timedAlerts.map((alert, index) => {
          const start = new Date(alert.startsAt as string);
          const end = new Date(alert.endsAt as string);
          const y = 14 + index * rowHeight;
          return (
            <Group key={alert.id}>
              <text x={marginLeft} y={y + 10} className="alert-label">
                {alert.event}
              </text>
              <rect
                x={x(start)}
                y={y + 16}
                width={Math.max(10, x(end) - x(start))}
                height={12}
                rx={6}
                fill={alertTone(alert.severity)}
              />
            </Group>
          );
        })}
      </svg>
      <div className="daylight-labels">
        <span>{formatTime(min.toISOString(), hourCycle)}</span>
        <span>{formatTime(max.toISOString(), hourCycle)}</span>
      </div>
    </ChartShell>
  );
}

export function buildHourlySeries(
  entries: Array<{
    time: string;
    isDay: number;
    temperature: number;
    precipitationAmount: number;
    precipitationProbability: number;
    windSpeed: number;
    windDirection: number;
    pressure: number;
    cloudCover: number;
    visibility: number;
  }>,
  hourCycle: "12h" | "24h",
  visibilityFactor: number,
) {
  return {
    temperature: entries.map((entry, index) => ({
      key: `${entry.time}-${index}`,
      time: entry.time,
      label: formatHourLabel(entry.time, hourCycle),
      shortLabel: formatHourTick(entry.time, hourCycle),
      isDay: entry.isDay === 1,
      value: entry.temperature,
    })),
    precipitation: entries.map((entry, index) => ({
      key: `${entry.time}-${index}`,
      time: entry.time,
      label: formatHourLabel(entry.time, hourCycle),
      shortLabel: formatHourTick(entry.time, hourCycle),
      value: entry.precipitationAmount,
      probability: entry.precipitationProbability,
    })),
    wind: entries.map((entry, index) => ({
      key: `${entry.time}-${index}`,
      time: entry.time,
      label: formatHourLabel(entry.time, hourCycle),
      shortLabel: formatHourTick(entry.time, hourCycle),
      value: entry.windSpeed,
      direction: entry.windDirection,
    })),
    pressure: entries.map((entry, index) => ({
      key: `${entry.time}-${index}`,
      time: entry.time,
      label: formatHourLabel(entry.time, hourCycle),
      shortLabel: formatHourTick(entry.time, hourCycle),
      value: entry.pressure,
    })),
    cloudVisibility: entries.map((entry, index) => ({
      key: `${entry.time}-${index}`,
      time: entry.time,
      label: formatHourLabel(entry.time, hourCycle),
      shortLabel: formatHourTick(entry.time, hourCycle),
      value: entry.cloudCover,
      secondaryValue: roundToOne(entry.visibility * visibilityFactor),
    })),
  };
}

export function buildWeeklyRangeSeries(daily: DailyWeather[]) {
  return daily.map((day) => ({
    key: day.date,
    label: formatTime(`${day.date}T12:00`, "12h"),
    shortLabel: new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(new Date(`${day.date}T00:00:00`)),
    min: day.temperatureMin,
    max: day.temperatureMax,
  }));
}

function ChartShell({ eyebrow, title, subtitle, footer, children }: ChartShellProps) {
  return (
    <article className="chart-card visx-card">
      <div className="chart-card-header">
        <div>
          <p className="section-label">{eyebrow}</p>
          <h4>{title}</h4>
          <strong>{subtitle}</strong>
        </div>
      </div>
      <div className="chart-shell visx-shell">{children}</div>
      {footer}
    </article>
  );
}

function AxisFooter({ labels, dense = false }: { labels: string[]; dense?: boolean }) {
  return (
    <div className={dense ? "chart-ticks dense" : "chart-ticks"}>
      {labels.map((label, index) => (
        <span key={`${label}-${index}`}>{label}</span>
      ))}
    </div>
  );
}

function Legend({
  items,
}: {
  items: Array<{ label: string; tone: "gold" | "sky" | "mint" }>;
}) {
  return (
    <div className="chart-legend">
      {items.map((item) => (
        <span key={item.label}>
          <i className={`legend-dot ${item.tone}`} aria-hidden="true" />
          {item.label}
        </span>
      ))}
    </div>
  );
}

function createValueDomain(values: number[], padding = 2): [number, number] {
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) {
    return [min - padding, max + padding];
  }

  return [min - padding, max + padding];
}

function summarizeRange(values: number[]) {
  return [Math.round(Math.min(...values)), Math.round(Math.max(...values))] as const;
}

function selectTickLabels(labels: string[]) {
  if (labels.length <= 4) {
    return labels;
  }

  const step = Math.max(1, Math.floor((labels.length - 1) / 3));
  return [labels[0], labels[step], labels[Math.min(labels.length - 1, step * 2)], labels[labels.length - 1]];
}

function formatHourTick(value: string, hourCycle: "12h" | "24h") {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    hour12: hourCycle === "12h",
  }).format(new Date(value));
}

function extractHourValue(value: string) {
  const date = new Date(value);
  return date.getHours() + date.getMinutes() / 60;
}

function directionVector(direction: number, length: number) {
  const radians = ((direction ?? 0) - 90) * (Math.PI / 180);
  return {
    x: Math.cos(radians) * length,
    y: Math.sin(radians) * length,
  };
}

function arrowHeadPoints(x: number, y: number, direction: number) {
  const radians = ((direction ?? 0) - 90) * (Math.PI / 180);
  const left = radians + Math.PI * 0.86;
  const right = radians - Math.PI * 0.86;
  const size = 4;
  const leftX = x + Math.cos(left) * size;
  const leftY = y + Math.sin(left) * size;
  const rightX = x + Math.cos(right) * size;
  const rightY = y + Math.sin(right) * size;
  return `${x},${y} ${leftX},${leftY} ${rightX},${rightY}`;
}

function alertTone(severity: string) {
  const value = severity.toLowerCase();
  if (value.includes("extreme")) {
    return "rgba(255, 112, 112, 0.95)";
  }
  if (value.includes("severe")) {
    return "rgba(255, 170, 89, 0.95)";
  }
  return "rgba(255, 213, 108, 0.92)";
}

function roundToOne(value: number) {
  return Math.round(value * 10) / 10;
}
