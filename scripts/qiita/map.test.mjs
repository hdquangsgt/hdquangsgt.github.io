import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { emptyMap, loadMap, saveMap, serializeMap } from './map.mjs';

const tmp = () => path.join(mkdtempSync(path.join(os.tmpdir(), 'qiita-map-')), 'map.json');

test('loadMap returns an empty map only when the file does not exist', () => {
  assert.deepEqual(loadMap(tmp()), emptyMap());
});

test('save then load round-trips with sorted, stable output', () => {
  const file = tmp();
  const map = { version: 1, items: { b: { state: 'synced', title: 'B', hash: 'h', itemId: '2', url: 'u' }, a: { state: 'pending', title: 'A', hash: 'h', startedAt: 't' } } };
  saveMap(file, map);
  assert.deepEqual(loadMap(file), map);
  assert.equal(readFileSync(file, 'utf8'), serializeMap(map));
  assert.ok(serializeMap(map).indexOf('"a"') < serializeMap(map).indexOf('"b"'));
  assert.ok(serializeMap(map).endsWith('\n'));
});

test('saveMap leaves no temp files behind', () => {
  const file = tmp();
  saveMap(file, emptyMap());
  assert.deepEqual(readdirSync(path.dirname(file)), ['map.json']);
});

test('corrupt or invalid maps throw instead of becoming empty (Review Focus 4)', () => {
  const file = tmp();
  writeFileSync(file, '{not json');
  assert.throws(() => loadMap(file), /not valid JSON/);
  writeFileSync(file, JSON.stringify({ version: 2, items: {} }));
  assert.throws(() => loadMap(file), /version/);
  writeFileSync(file, JSON.stringify({ version: 1 }));
  assert.throws(() => loadMap(file), /items/);
  writeFileSync(file, JSON.stringify({ version: 1, items: { a: { state: 'weird', title: 't', hash: 'h' } } }));
  assert.throws(() => loadMap(file), /state/);
  writeFileSync(file, JSON.stringify({ version: 1, items: { a: { state: 'synced', title: 't', hash: 'h' } } }));
  assert.throws(() => loadMap(file), /itemId/);
  assert.equal(existsSync(file), true);
});
