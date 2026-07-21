import { markStaleDevicesOffline } from './presenceHelpers.js';

const TICK_MS = 60_000;

let timer = null;
let running = false;

async function tick() {
  if (running) return;
  running = true;
  try {
    const marked = await markStaleDevicesOffline();
    if (marked > 0) {
      console.log(`[presence] Marked ${marked} device(s) offline (missed heartbeat)`);
    }
  } catch (error) {
    console.warn('[presence] Scheduler tick failed:', error.message);
  } finally {
    running = false;
  }
}

export function startPresenceScheduler() {
  if (timer) return;
  console.log('[presence] Scheduler started (tick every 60s)');
  setTimeout(() => {
    tick().catch(() => {});
  }, 10_000);
  timer = setInterval(() => {
    tick().catch(() => {});
  }, TICK_MS);
  if (typeof timer.unref === 'function') {
    timer.unref();
  }
}

export function stopPresenceScheduler() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
