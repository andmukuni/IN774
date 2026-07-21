import { sendEmail } from './emailService.js';
import {
  applyCheckOutcome,
  broadcastMonitorSnapshot,
  listDueMonitorTargets,
  pruneOldCheckResults,
} from './monitorHelpers.js';
import { runProbe } from './monitorProbes.js';

const TICK_MS = 30_000;
const MAX_CONCURRENCY = 3;
const PRUNE_EVERY_TICKS = 120;

let timer = null;
let running = false;
let tickCount = 0;

async function notifyTransition(target, transition) {
  const to = String(target.notifyEmail || '').trim();
  if (!to || !transition?.to) return;

  const wentDown = transition.to === 'down';
  const subject = wentDown
    ? `[Monitor] DOWN: ${target.name}`
    : `[Monitor] RECOVERED: ${target.name}`;
  const lines = [
    `Target: ${target.name}`,
    `Type: ${target.type}`,
    `Endpoint: ${target.hostOrUrl}${target.port && target.type !== 'http' ? `:${target.port}` : ''}`,
    `Status: ${transition.from} → ${transition.to}`,
    target.lastError ? `Last error: ${target.lastError}` : null,
    target.lastLatencyMs != null ? `Latency: ${target.lastLatencyMs} ms` : null,
    `Checked at: ${target.lastCheckedAt || new Date().toISOString()}`,
  ].filter(Boolean);

  const text = lines.join('\n');
  const html = `<pre style="font-family:ui-monospace,monospace;font-size:13px">${lines.map((l) => String(l)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')).join('\n')}</pre>`;

  try {
    await sendEmail({ to, subject, text, html });
  } catch (error) {
    console.warn('[monitor] Alert email failed:', error.message);
  }
}

async function runWithConcurrency(items, limit, worker) {
  const queue = [...items];
  const runners = Array.from({ length: Math.min(limit, queue.length) }, async () => {
    while (queue.length) {
      const item = queue.shift();
      if (!item) break;
      await worker(item);
    }
  });
  await Promise.all(runners);
}

export async function executeTargetCheck(target) {
  const result = await runProbe(target);
  const outcome = await applyCheckOutcome(target, result);
  if (outcome.transition) {
    await notifyTransition(outcome.target, outcome.transition);
  }
  return outcome;
}

async function tick() {
  if (running) return;
  running = true;
  tickCount += 1;
  try {
    const due = await listDueMonitorTargets({ limit: 20 });
    if (due.length) {
      await runWithConcurrency(due, MAX_CONCURRENCY, async (target) => {
        try {
          await executeTargetCheck(target);
        } catch (error) {
          console.warn(`[monitor] Check failed for ${target.id}:`, error.message);
        }
      });
      await broadcastMonitorSnapshot();
    }
    if (tickCount % PRUNE_EVERY_TICKS === 0) {
      await pruneOldCheckResults();
    }
  } catch (error) {
    console.warn('[monitor] Scheduler tick failed:', error.message);
  } finally {
    running = false;
  }
}

export function startMonitorScheduler() {
  if (timer) return;
  console.log('[monitor] Scheduler started (tick every 30s)');
  setTimeout(() => {
    tick().catch(() => {});
  }, 5_000);
  timer = setInterval(() => {
    tick().catch(() => {});
  }, TICK_MS);
  if (typeof timer.unref === 'function') {
    timer.unref();
  }
}

export function stopMonitorScheduler() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
