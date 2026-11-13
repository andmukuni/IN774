import { useEffect, useRef, useState } from 'react';
import { getApiBase } from '../utils/apiBase';
import { getAdminAuthHeaders } from '../utils/authHeaders';

const API_BASE = getApiBase();
const MAX_RECONNECT_MS = 15_000;

function parseSseBlock(block) {
  if (!block || block.startsWith(':')) return null;
  let event = 'message';
  let data = '';
  for (const line of block.split('\n')) {
    if (line.startsWith('event:')) event = line.slice(6).trim();
    else if (line.startsWith('data:')) data += line.slice(5).trim();
  }
  if (!data) return null;
  try {
    return { event, data: JSON.parse(data) };
  } catch {
    return null;
  }
}

export function usePresenceStream({ enabled = true, onSnapshot, onError }) {
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState('');
  const onSnapshotRef = useRef(onSnapshot);
  const onErrorRef = useRef(onError);
  onSnapshotRef.current = onSnapshot;
  onErrorRef.current = onError;

  useEffect(() => {
    if (!enabled) return undefined;

    const controller = new AbortController();
    let cancelled = false;
    let reconnectMs = 1000;

    async function connect() {
      while (!cancelled) {
        try {
          const res = await fetch(`${API_BASE}/admin/presence/stream`, {
            headers: {
              ...getAdminAuthHeaders(),
              Accept: 'text/event-stream',
            },
            signal: controller.signal,
            cache: 'no-store',
          });

          if (!res.ok || !res.body) {
            throw new Error(`Live stream unavailable (${res.status})`);
          }

          setConnected(true);
          setError('');
          reconnectMs = 1000;

          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';

          while (!cancelled) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            let splitAt = buffer.indexOf('\n\n');
            while (splitAt !== -1) {
              const block = buffer.slice(0, splitAt);
              buffer = buffer.slice(splitAt + 2);
              const parsed = parseSseBlock(block);
              if (parsed?.event === 'snapshot' && Array.isArray(parsed.data?.devices)) {
                onSnapshotRef.current?.(parsed.data.devices, parsed.data);
              } else if (parsed?.event === 'error') {
                onErrorRef.current?.(parsed.data?.message || 'Stream error');
              }
              splitAt = buffer.indexOf('\n\n');
            }
          }

          if (!cancelled) {
            throw new Error('Live stream closed');
          }
        } catch (err) {
          if (controller.signal.aborted || cancelled) return;
          const message = err?.message || 'Live stream disconnected';
          setConnected(false);
          setError(message);
          onErrorRef.current?.(message);
          await new Promise((resolve) => {
            window.setTimeout(resolve, reconnectMs);
          });
          reconnectMs = Math.min(reconnectMs * 2, MAX_RECONNECT_MS);
        }
      }
    }

    connect();

    return () => {
      cancelled = true;
      controller.abort();
      setConnected(false);
    };
  }, [enabled]);

  return { connected, error };
}
