/** In-process pub/sub for presence SSE clients (single Node instance). */

const clients = new Set();
let broadcastTimer = null;
let broadcastFn = null;

function writeEvent(res, event, data) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

export function addPresenceStreamClient(res) {
  clients.add(res);
  return () => {
    clients.delete(res);
  };
}

export function publishPresenceEvent(event, data) {
  if (!clients.size) return;
  for (const res of clients) {
    try {
      writeEvent(res, event, data);
    } catch {
      clients.delete(res);
    }
  }
}

export function sendPresenceStreamEvent(res, event, data) {
  writeEvent(res, event, data);
}

export function hasPresenceStreamClients() {
  return clients.size > 0;
}

/** Register the async snapshot broadcaster (avoids circular imports). */
export function setPresenceBroadcastHandler(fn) {
  broadcastFn = fn;
}

/** Coalesce rapid heartbeats into one snapshot push. */
export function schedulePresenceBroadcast({ delayMs = 1000, immediate = false } = {}) {
  if (!broadcastFn) return;
  if (immediate) {
    if (broadcastTimer) {
      clearTimeout(broadcastTimer);
      broadcastTimer = null;
    }
    Promise.resolve()
      .then(() => broadcastFn())
      .catch(() => {});
    return;
  }
  if (broadcastTimer) return;
  broadcastTimer = setTimeout(() => {
    broadcastTimer = null;
    Promise.resolve()
      .then(() => broadcastFn())
      .catch(() => {});
  }, delayMs);
  if (typeof broadcastTimer.unref === 'function') {
    broadcastTimer.unref();
  }
}
