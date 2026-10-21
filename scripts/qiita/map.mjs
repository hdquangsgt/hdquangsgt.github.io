import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';

const VERSION = 1;
const STATES = ['pending', 'synced', 'unpublishing'];

export function emptyMap() {
  return { version: VERSION, items: {} };
}

function validate(map, file) {
  if (!map || typeof map !== 'object' || map.version !== VERSION) {
    throw new Error(`${file}: unsupported map version (expected ${VERSION})`);
  }
  if (!map.items || typeof map.items !== 'object' || Array.isArray(map.items)) {
    throw new Error(`${file}: "items" must be an object`);
  }
  for (const [slug, e] of Object.entries(map.items)) {
    if (!STATES.includes(e?.state)) throw new Error(`${file}: "${slug}" has invalid state "${e?.state}"`);
    if (!e.title || !e.hash) throw new Error(`${file}: "${slug}" needs title and hash`);
    if (e.state !== 'pending' && !e.itemId) throw new Error(`${file}: "${slug}" (${e.state}) needs itemId`);
  }
  return map;
}

/** A missing file is an empty map; anything unreadable throws, because guessing "empty" would create duplicates. */
export function loadMap(file) {
  if (!existsSync(file)) return emptyMap();
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(file, 'utf8'));
  } catch (e) {
    throw new Error(`${file} is not valid JSON: ${e.message}`);
  }
  return validate(parsed, file);
}

export function serializeMap(map) {
  const items = Object.fromEntries(Object.keys(map.items).sort().map((k) => [k, map.items[k]]));
  return `${JSON.stringify({ version: map.version, items }, null, 2)}\n`;
}

export function saveMap(file, map) {
  const tmp = `${file}.tmp-${process.pid}`;
  writeFileSync(tmp, serializeMap(map));
  renameSync(tmp, file);
}
