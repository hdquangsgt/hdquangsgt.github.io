import { createHash } from 'node:crypto';

/** Bump when conversion output changes on purpose, so every post re-syncs once. */
export const CONVERTER_VERSION = 'v1';
export const MAX_TAGS = 5;
const VISIBILITIES = ['limited', 'public'];

export function normalizeBody(body) {
  const lines = body
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((l) => l.replace(/[ \t]+$/, ''));
  return lines.join('\n').replace(/\n+$/, '') + '\n';
}

export function normalizeTags(tags) {
  const seen = new Set();
  const out = [];
  for (const raw of tags ?? []) {
    const name = String(raw).trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  if (out.length === 0) throw new Error('Qiita needs at least one tag');
  if (out.length > MAX_TAGS) {
    throw new Error(`Qiita allows at most ${MAX_TAGS} tags, got ${out.length}: ${out.join(', ')}`);
  }
  return out;
}

export function buildPayload({ title, body, tags, visibility = 'limited' }) {
  if (!title || !title.trim()) throw new Error('title is required');
  if (!VISIBILITIES.includes(visibility)) {
    throw new Error(`visibility must be one of ${VISIBILITIES.join(', ')}, got "${visibility}"`);
  }
  return {
    title: title.trim(),
    body: normalizeBody(body),
    tags: normalizeTags(tags).map((name) => ({ name, versions: [] })),
    private: visibility !== 'public',
  };
}

export function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonicalJson(value[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

export function hashPayload(payload) {
  return createHash('sha256').update(`${CONVERTER_VERSION}:${canonicalJson(payload)}`).digest('hex');
}
