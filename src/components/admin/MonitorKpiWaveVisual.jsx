import { useEffect, useId, useMemo, useRef } from 'react';

export const WAVE_COLORS = {
  green: { stroke: '#10b981', fill: 'rgba(16, 185, 129, 0.18)', glow: 'rgba(16, 185, 129, 0.35)' },
  cyan: { stroke: '#0891b2', fill: 'rgba(8, 145, 178, 0.18)', glow: 'rgba(8, 145, 178, 0.35)' },
  amber: { stroke: '#f59e0b', fill: 'rgba(245, 158, 11, 0.2)', glow: 'rgba(245, 158, 11, 0.35)' },
  red: { stroke: '#ef4444', fill: 'rgba(239, 68, 68, 0.2)', glow: 'rgba(239, 68, 68, 0.35)' },
  gray: { stroke: '#64748b', fill: 'rgba(100, 116, 139, 0.14)', glow: 'rgba(100, 116, 139, 0.25)' },
};

export function buildWavePath(width, height, baseline, amplitude, frequency, phase) {
  if (amplitude <= 0.2) {
    return `M 0,${baseline} L ${width},${baseline} L ${width},${height} L 0,${height} Z`;
  }

  const step = 3;
  let path = `M 0,${height} L 0,${baseline}`;
  for (let x = 0; x <= width; x += step) {
    const y = baseline
      + Math.sin((x / width) * Math.PI * 2 * frequency + phase) * amplitude
      + Math.sin((x / width) * Math.PI * 4 * frequency + phase * 1.4) * (amplitude * 0.35);
    path += ` L ${x},${y.toFixed(2)}`;
  }
  path += ` L ${width},${height} Z`;
  return path;
}

function computeStress(variant, { percent, up = 0, total = 0, issues = 0 } = {}) {
  if (variant === 'issues') {
    if (issues <= 0) return 0.04;
    return Math.min(1, 0.25 + (issues / Math.max(total, 1)) * 0.75);
  }
  if (variant === 'online') {
    if (total <= 0) return 0.1;
    return 1 - Math.min(1, up / total);
  }
  if (percent == null) return 0.15;
  return 1 - Math.min(100, Math.max(0, percent)) / 100;
}

function sparklineFromHistory(history, width, height, { invert = false } = {}) {
  const samples = history.filter((v) => Number.isFinite(v));
  if (samples.length < 2) return '';

  const max = Math.max(...samples, 1);
  const min = Math.min(...samples, 0);
  const range = max - min || 1;

  return samples.map((value, index) => {
    const x = (index / (samples.length - 1)) * width;
    const normalized = (value - min) / range;
    const plotted = invert ? 1 - normalized : normalized;
    const y = height - 6 - plotted * (height - 14);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
}

export default function MonitorKpiWaveVisual({
  variant = 'performance',
  percent = null,
  up = 0,
  total = 0,
  issues = 0,
  history = [],
  streamConnected = false,
  color = 'cyan',
  streamTick = 0,
  meta = '',
}) {
  const phaseRef = useRef(0);
  const svgRef = useRef(null);
  const rafRef = useRef(0);
  const gradientId = useId();

  const palette = WAVE_COLORS[color] || WAVE_COLORS.cyan;
  const width = 240;
  const height = 44;
  const baseline = 18;

  const stress = useMemo(
    () => computeStress(variant, { percent, up, total, issues }),
    [variant, percent, up, total, issues],
  );

  const amplitude = 2 + stress * 14;
  const speed = streamConnected ? 0.045 : 0.02;

  useEffect(() => {
    const layers = [
      { ampScale: 0.55, freq: 1.1, phaseOffset: 0 },
      { ampScale: 0.8, freq: 1.6, phaseOffset: 1.2 },
      { ampScale: 1, freq: 2.1, phaseOffset: 2.4 },
    ];

    const tick = () => {
      phaseRef.current += speed;
      const phase = phaseRef.current;
      const [back, mid, front] = layers.map((layer) => buildWavePath(
        width,
        height,
        baseline,
        amplitude * layer.ampScale,
        layer.freq,
        phase + layer.phaseOffset,
      ));

      const svg = svgRef.current;
      if (svg) {
        const backEl = svg.querySelector('[data-wave="back"]');
        const midEl = svg.querySelector('[data-wave="mid"]');
        const frontEl = svg.querySelector('[data-wave="front"]');
        if (backEl) backEl.setAttribute('d', back);
        if (midEl) midEl.setAttribute('d', mid);
        if (frontEl) frontEl.setAttribute('d', front);
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [amplitude, speed]);

  const sparkPoints = useMemo(() => {
    if (history.length < 2) return '';
    return sparklineFromHistory(history, width, height, { invert: variant === 'issues' });
  }, [history, streamTick, variant]);

  const initialBack = buildWavePath(width, height, baseline, amplitude * 0.55, 1.1, 0);
  const initialMid = buildWavePath(width, height, baseline, amplitude * 0.8, 1.6, 1.2);
  const initialFront = buildWavePath(width, height, baseline, amplitude, 2.1, 2.4);

  const sampleLabel = history.length > 1 ? `${history.length} samples` : 'sampling…';

  return (
    <div className="relative mt-2 -mx-1 h-11 overflow-hidden rounded-lg bg-gradient-to-t from-navy-50/80 to-transparent">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        className="absolute inset-0 h-full w-full"
        preserveAspectRatio="none"
        aria-hidden
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={palette.fill} />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
        </defs>

        <path data-wave="back" d={initialBack} fill={`url(#${gradientId})`} opacity="0.45" />
        <path data-wave="mid" d={initialMid} fill={palette.fill} opacity="0.65" />
        <path
          data-wave="front"
          d={initialFront}
          fill="none"
          stroke={palette.stroke}
          strokeWidth="1.5"
          strokeLinecap="round"
          opacity="0.9"
          style={{ filter: streamConnected ? `drop-shadow(0 0 4px ${palette.glow})` : undefined }}
        />

        {sparkPoints && (
          <polyline
            key={`spark-${variant}-${streamTick}-${sparkPoints}`}
            points={sparkPoints}
            fill="none"
            stroke={palette.stroke}
            strokeWidth="1.25"
            strokeLinejoin="round"
            strokeLinecap="round"
            opacity="0.55"
            className="monitor-sparkline-line"
          />
        )}
      </svg>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between px-1.5 pb-0.5">
        <span className={`text-[9px] font-medium uppercase tracking-wide ${streamConnected ? 'text-cyan-600' : 'text-amber-600'}`}>
          {streamConnected ? 'SSE live' : 'SSE reconnecting'}
        </span>
        <span className="text-[9px] tabular-nums text-navy-400">
          {meta || sampleLabel}
        </span>
      </div>
    </div>
  );
}
