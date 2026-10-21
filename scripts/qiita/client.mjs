import { QIITA_API } from './config.mjs';

export class QiitaApiError extends Error {
  constructor(status, type, message) {
    super(message);
    this.status = status;
    this.type = type;
  }
}
/** The outcome is unknown: the request may or may not have been applied. */
export class QiitaNetworkError extends Error {}
export class DryRunError extends Error {}

/** True only when Qiita answered 4xx, i.e. it definitively did not apply the request. */
export function isDefinitiveFailure(err) {
  return err instanceof QiitaApiError && err.status >= 400 && err.status < 500;
}

export function redact(text, token) {
  return token ? String(text).split(token).join('***') : String(text);
}

export function createClient({ token, fetchImpl = globalThis.fetch, baseUrl = QIITA_API, dryRun = false, timeoutMs = 30000 }) {
  async function request(method, pathname, body) {
    if (dryRun && method !== 'GET') throw new DryRunError(`dry-run: refusing ${method} ${pathname}`);
    if (!token) throw new Error('QIITA_TOKEN is not set');
    let res;
    try {
      res = await fetchImpl(`${baseUrl}${pathname}`, {
        method,
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (e) {
      throw new QiitaNetworkError(redact(`${method} ${pathname}: ${e.message}`, token));
    }
    const text = await res.text();
    let parsed;
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = undefined;
      }
    }
    if (!res.ok) {
      const message = parsed?.message ?? text.slice(0, 200);
      throw new QiitaApiError(res.status, parsed?.type, redact(`${method} ${pathname} -> ${res.status}: ${message}`, token));
    }
    if (text && parsed === undefined) throw new QiitaNetworkError(`${method} ${pathname}: unparseable response`);
    return parsed;
  }

  const enc = encodeURIComponent;
  return {
    request,
    createItem: (payload) => request('POST', '/items', payload),
    updateItem: (id, payload) => request('PATCH', `/items/${enc(id)}`, payload),
    getItem: (id) => request('GET', `/items/${enc(id)}`),
    deleteItem: (id) => request('DELETE', `/items/${enc(id)}`),
    getAuthenticatedUser: () => request('GET', '/authenticated_user'),
    async listMyItems() {
      const all = [];
      for (let page = 1; page <= 20; page++) {
        const items = await request('GET', `/authenticated_user/items?page=${page}&per_page=100`);
        all.push(...items);
        if (items.length < 100) break;
      }
      return all;
    },
  };
}
