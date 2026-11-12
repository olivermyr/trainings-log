import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import './chart.css';

/**
 * Small, dependency-free SVG charts.
 * Specs: 2px lines, ≥8px markers with a 2px surface ring, ≤24px columns with 4px rounded data-ends,
 * hairline solid gridlines, one y-axis, hover/touch tooltip on every chart, text in text colours only.
 */

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.floor(e.contentRect.width)));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

/** Clean tick values covering [min, max]. */
export function niceTicks(min: number, max: number, count = 4, mode: 'any' | 'integer' | 'time' = 'any'): number[] {
  if (min === max) {
    const pad = Math.abs(min) * 0.1 || 1;
    min -= pad;
    max += pad;
  }
  const raw = (max - min) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  let step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag;
  if (mode === 'integer') step = Math.max(1, Math.ceil(step));
  if (mode === 'time') step = [15, 30, 60, 120, 300, 600].find((s) => s >= raw) ?? 600;
  const start = Math.floor(min / step) * step;
  const end = Math.ceil(max / step) * step;
  const out: number[] = [];
  for (let v = start; v <= end + step / 2; v += step) out.push(Math.round(v * 1000) / 1000);
  return out;
}

const PAD = { top: 16, right: 16, bottom: 26, left: 44 };

export interface LinePoint {
  /** YYYY-MM-DD */
  date: string;
  value: number;
  /** Tooltip lines: first is the value (strong), rest are labels. */
  tip: string[];
}

const dayNum = (d: string) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) / 86_400_000;
const SHORT = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const shortDate = (d: string) => SHORT.format(new Date(dayNum(d) * 86_400_000));

export function LineChart({
  points,
  format,
  goal,
  height = 200,
  label,
  zeroBased = false,
  tickMode = 'any',
}: {
  tickMode?: 'any' | 'integer' | 'time';
  points: LinePoint[];
  format: (v: number) => string;
  goal?: { value: number; label: string };
  height?: number;
  label: string;
  zeroBased?: boolean;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);

  const geo = useMemo(() => {
    if (!width || points.length === 0) return null;
    const vals = points.map((p) => p.value).concat(goal ? [goal.value] : []);
    const ticks = niceTicks(zeroBased ? 0 : Math.min(...vals), Math.max(...vals), 4, tickMode);
    const y0 = ticks[0];
    const y1 = ticks.at(-1)!;
    const x0 = dayNum(points[0].date);
    const x1 = dayNum(points.at(-1)!.date);
    const iw = width - PAD.left - PAD.right;
    const ih = height - PAD.top - PAD.bottom;
    const sx = (d: string) => (x1 === x0 ? PAD.left + iw / 2 : PAD.left + ((dayNum(d) - x0) / (x1 - x0)) * iw);
    const sy = (v: number) => PAD.top + ih - ((v - y0) / (y1 - y0 || 1)) * ih;
    const xy = points.map((p) => [sx(p.date), sy(p.value)] as const);
    const xLabels = x1 === x0 ? [points[0].date] : [points[0].date, points.at(-1)!.date];
    return { ticks, sy, xy, iw, ih, xLabels, sx };
  }, [width, points, height, goal, zeroBased, tickMode]);

  const nearest = (clientX: number, el: Element) => {
    if (!geo) return null;
    const x = clientX - el.getBoundingClientRect().left;
    let best = 0;
    geo.xy.forEach(([px], i) => {
      if (Math.abs(px - x) < Math.abs(geo.xy[best][0] - x)) best = i;
    });
    return best;
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowRight') setActive((a) => Math.min(points.length - 1, (a ?? -1) + 1));
    if (e.key === 'ArrowLeft') setActive((a) => Math.max(0, (a ?? points.length) - 1));
    if (e.key === 'Escape') setActive(null);
  };

  const a = active != null && geo ? { p: points[active], xy: geo.xy[active] } : null;

  return (
    <div className="chart" ref={ref} style={{ height }}>
      {geo && (
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={label}
          tabIndex={0}
          onKeyDown={onKey}
          onBlur={() => setActive(null)}
          onPointerMove={(e: PointerEvent<SVGSVGElement>) => setActive(nearest(e.clientX, e.currentTarget))}
          onPointerDown={(e: PointerEvent<SVGSVGElement>) => setActive(nearest(e.clientX, e.currentTarget))}
          onPointerLeave={(e) => e.pointerType === 'mouse' && setActive(null)}
        >
          {geo.ticks.map((t) => (
            <g key={t}>
              <line className="grid" x1={PAD.left} x2={width - PAD.right} y1={geo.sy(t)} y2={geo.sy(t)} />
              <text className="axis" x={PAD.left - 8} y={geo.sy(t)} textAnchor="end" dominantBaseline="middle">
                {format(t)}
              </text>
            </g>
          ))}
          {geo.xLabels.map((d, i) => (
            <text
              key={d + i}
              className="axis"
              x={geo.xLabels.length === 1 ? geo.sx(d) : i === 0 ? PAD.left : width - PAD.right}
              y={height - 6}
              textAnchor={geo.xLabels.length === 1 ? 'middle' : i === 0 ? 'start' : 'end'}
            >
              {shortDate(d)}
            </text>
          ))}
          {goal && (
            <g>
              <line className="goal" x1={PAD.left} x2={width - PAD.right} y1={geo.sy(goal.value)} y2={geo.sy(goal.value)} />
              <text className="goal-label" x={width - PAD.right} y={geo.sy(goal.value) - 6} textAnchor="end">
                {goal.label}
              </text>
            </g>
          )}
          {geo.xy.length > 1 && (
            <polyline className="series-line" points={geo.xy.map(([x, y]) => `${x},${y}`).join(' ')} />
          )}
          {/* Markers on every point only for short series; long series keep just the latest point */}
          {geo.xy.map(([x, y], i) =>
            points.length <= 16 || i === points.length - 1 ? (
              <circle key={i} className="series-dot" cx={x} cy={y} r={i === points.length - 1 ? 5 : 4} />
            ) : null,
          )}
          {a && <line className="crosshair" x1={a.xy[0]} x2={a.xy[0]} y1={PAD.top} y2={height - PAD.bottom} />}
          {a && <circle className="series-dot active" cx={a.xy[0]} cy={a.xy[1]} r={6} />}
        </svg>
      )}
      {a && geo && <Tooltip x={a.xy[0]} width={width} lines={[...a.p.tip, shortDate(a.p.date)]} />}
    </div>
  );
}

export interface Column {
  key: string;
  /** Short axis label (shown sparsely). */
  label: string;
  value: number;
  tip: string[];
  muted?: boolean;
}

export function ColumnChart({
  columns,
  format,
  height = 180,
  label,
  integer = false,
}: {
  integer?: boolean;
  columns: Column[];
  format: (v: number) => string;
  height?: number;
  label: string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  if (columns.length === 0) return null;
  const max = Math.max(1, ...columns.map((c) => c.value));
  const ticks = niceTicks(0, max, 3, integer ? 'integer' : 'any');
  const top = ticks.at(-1)!;
  const iw = Math.max(0, width - PAD.left - PAD.right);
  const ih = height - PAD.top - PAD.bottom;
  const slot = iw / columns.length;
  const bw = Math.max(2, Math.min(24, slot - 2));
  const sy = (v: number) => PAD.top + ih - (v / top) * ih;
  const every = Math.ceil(columns.length / Math.max(1, Math.floor(iw / 44)));

  return (
    <div className="chart" ref={ref} style={{ height }}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={label} onPointerLeave={(e) => e.pointerType === 'mouse' && setActive(null)}>
          {ticks.map((t) => (
            <g key={t}>
              <line className="grid" x1={PAD.left} x2={width - PAD.right} y1={sy(t)} y2={sy(t)} />
              <text className="axis" x={PAD.left - 8} y={sy(t)} textAnchor="end" dominantBaseline="middle">
                {format(t)}
              </text>
            </g>
          ))}
          {columns.map((c, i) => {
            const x = PAD.left + i * slot + (slot - bw) / 2;
            const y = sy(c.value);
            const h = PAD.top + ih - y;
            return (
              <g key={c.key}>
                {/* hit target: the whole slot, taller than the mark */}
                <rect
                  className="hit"
                  x={PAD.left + i * slot}
                  y={PAD.top}
                  width={slot}
                  height={ih}
                  tabIndex={0}
                  aria-label={`${c.label}: ${c.tip.join(', ')}`}
                  onPointerEnter={() => setActive(i)}
                  onPointerDown={() => setActive(i)}
                  onFocus={() => setActive(i)}
                  onBlur={() => setActive(null)}
                />
                {c.value > 0 && <path className={`col${c.muted ? ' muted' : ''}${active === i ? ' on' : ''}`} d={roundTop(x, y, bw, h)} />}
                {i % every === 0 && (
                  <text className="axis" x={x + bw / 2} y={height - 6} textAnchor="middle">
                    {c.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      )}
      {active != null && width > 0 && (
        <Tooltip x={PAD.left + active * slot + slot / 2} width={width} lines={columns[active].tip} />
      )}
    </div>
  );
}

/** Column path: 4px rounded data-end, square at the baseline. */
function roundTop(x: number, y: number, w: number, h: number) {
  const r = Math.min(4, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

export interface HBar {
  key: string;
  label: string;
  value: number;
  display: string;
}

/** Horizontal bars with the value at the tip. No target line by design. */
export function HBarChart({
  rows,
  selected,
  onSelect,
  label,
}: {
  rows: HBar[];
  selected?: string;
  onSelect?: (key: string) => void;
  label: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="hbars" role="list" aria-label={label}>
      {rows.map((r) => (
        <button
          key={r.key}
          role="listitem"
          className={`hbar${selected === r.key ? ' sel' : ''}`}
          onClick={() => onSelect?.(r.key)}
          aria-pressed={selected === r.key}
        >
          <span className="hbar-label">{r.label}</span>
          <span className="hbar-track">
            {r.value > 0 && <span className="hbar-fill" style={{ width: `calc((100% - 52px) * ${r.value / max})` }} />}
            <span className="hbar-value num">{r.display}</span>
          </span>
        </button>
      ))}
    </div>
  );
}

function Tooltip({ x, width, lines }: { x: number; width: number; lines: string[] }) {
  const left = Math.min(Math.max(x, 70), width - 70);
  return (
    <div className="chart-tip" style={{ left }} role="status">
      <strong className="num">{lines[0]}</strong>
      {lines.slice(1).map((l, i) => (
        <span key={i}>{l}</span>
      ))}
    </div>
  );
}
