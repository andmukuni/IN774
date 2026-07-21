const SPEED_SCORE = {
  fast: 100,
  good: 85,
  moderate: 65,
  slow: 40,
  down: 0,
  unknown: 50,
};

export function latencyToPerformancePercent(latencyMs, status) {
  if (status === 'down') return 0;
  if (status === 'unknown' || latencyMs == null) return null;
  if (latencyMs <= 100) return 100;
  if (latencyMs <= 200) return 95;
  if (latencyMs <= 600) return 85;
  if (latencyMs <= 1500) return 65;
  if (latencyMs <= 3000) return 40;
  return 20;
}

export function computeMonitorKpis(targets = []) {
  const enabled = targets.filter((t) => t.enabled !== false);
  const total = enabled.length;
  const up = enabled.filter((t) => t.status === 'up').length;
  const down = enabled.filter((t) => t.status === 'down').length;
  const unknown = enabled.filter((t) => t.status === 'unknown').length;

  const availabilityPercent = total ? Math.round((up / total) * 100) : 100;

  const perfFromSpeed = enabled
    .map((t) => SPEED_SCORE[t.speed?.tone] ?? latencyToPerformancePercent(
      t.lastLatencyMs ?? t.avgLatencyMs,
      t.status,
    ))
    .filter((v) => v != null);

  const performancePercent = perfFromSpeed.length
    ? Math.round(perfFromSpeed.reduce((sum, v) => sum + v, 0) / perfFromSpeed.length)
    : null;

  return {
    total,
    up,
    down,
    unknown,
    availabilityPercent,
    performancePercent,
  };
}

export function availabilityKpiColor({ down, unknown, availabilityPercent }) {
  if (down > 0) return 'red';
  if (unknown > 0 || availabilityPercent < 100) return 'amber';
  return 'green';
}

export function performanceKpiColor(performancePercent) {
  if (performancePercent == null) return 'gray';
  if (performancePercent >= 85) return 'green';
  if (performancePercent >= 65) return 'cyan';
  if (performancePercent >= 40) return 'amber';
  return 'red';
}

export function statusSummaryColor({ down, unknown }) {
  if (down > 0) return 'red';
  if (unknown > 0) return 'amber';
  return 'green';
}
