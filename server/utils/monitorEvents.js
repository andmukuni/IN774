/** In-process pub/sub for monitor SSE clients (single Node instance). */

const clients = new Set();

function writeEvent(res, event, data) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

export function addMonitorStreamClient(res) {
  clients.add(res);
  return () => {
    clients.delete(res);
  };
}

export function publishMonitorEvent(event, data) {
  if (!clients.size) return;
  for (const res of clients) {
    try {
      writeEvent(res, event, data);
    } catch {
      clients.delete(res);
    }
  }
}

export function sendMonitorStreamEvent(res, event, data) {
  writeEvent(res, event, data);
}
