const KEY = 'faro.token';

export function initToken() {
  const url = new URL(window.location.href);
  const fromUrl = url.searchParams.get('token');
  if (fromUrl) {
    try { localStorage.setItem(KEY, fromUrl); } catch {}
    url.searchParams.delete('token');
    window.history.replaceState({}, '', url.pathname + url.search);
    return fromUrl;
  }
  try { return localStorage.getItem(KEY) || ''; } catch { return ''; }
}

export const saveToken = (t) => { try { localStorage.setItem(KEY, t); } catch {} };

export async function api(token, path, opts = {}) {
  const res = await fetch(`/api${path}`, {
    method: opts.method || 'GET',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || `Error ${res.status}`), { status: res.status });
  return data;
}

export function openSocket(token, onMessage, onClose) {
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
  const ws = new WebSocket(`${proto}://${window.location.host}/ws?token=${encodeURIComponent(token)}`);
  ws.onmessage = (e) => { try { onMessage(JSON.parse(e.data)); } catch {} };
  ws.onclose = onClose;
  return ws;
}
