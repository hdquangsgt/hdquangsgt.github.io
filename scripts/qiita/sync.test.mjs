import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { QiitaApiError, QiitaNetworkError } from './client.mjs';
import { emptyMap, loadMap } from './map.mjs';
import { planSync, runSync } from './sync.mjs';

const mapFile = () => path.join(mkdtempSync(path.join(os.tmpdir(), 'qiita-sync-')), 'map.json');
const item = (slug = 'pi', hash = 'h1', title = 'Pi') => ({ slug, title, hash, payload: { title, body: 'b\n', tags: [{ name: 'a', versions: [] }], private: true } });
function fakeClient(over = {}) {
  const calls = [];
  return {
    calls,
    createItem: async (p) => (calls.push(['create', p.title]), { id: 'item1', url: 'https://qiita.com/u/items/item1' }),
    updateItem: async (id, p) => (calls.push(['update', id, p.title]), { id, url: `https://qiita.com/u/items/${id}` }),
    listMyItems: async () => [],
    getItem: async () => { throw new Error('unexpected getItem'); },
    deleteItem: async () => { throw new Error('unexpected deleteItem'); },
    getAuthenticatedUser: async () => ({ id: 'me' }),
    ...over,
  };
}
const run = (over) => runSync({ prepared: [item()], map: emptyMap(), mapPath: mapFile(), client: fakeClient(), ...over });

test('creates a new item and records it as synced on disk', async () => {
  const mapPath = mapFile();
  const map = emptyMap();
  const client = fakeClient();
  const results = await runSync({ prepared: [item()], map, mapPath, client });
  assert.deepEqual(client.calls, [['create', 'Pi']]);
  assert.deepEqual(results, [{ slug: 'pi', action: 'create', url: 'https://qiita.com/u/items/item1' }]);
  assert.deepEqual(loadMap(mapPath).items.pi, { state: 'synced', itemId: 'item1', url: 'https://qiita.com/u/items/item1', title: 'Pi', hash: 'h1' });
});

test('writes pending to disk before the POST (write-ahead)', async () => {
  const mapPath = mapFile();
  let onDisk;
  const client = fakeClient({
    createItem: async () => {
      onDisk = JSON.parse(readFileSync(mapPath, 'utf8')).items.pi;
      return { id: 'i', url: 'u' };
    },
  });
  await runSync({ prepared: [item()], map: emptyMap(), mapPath, client, now: () => new Date('2026-01-01T00:00:00Z') });
  assert.equal(onDisk.state, 'pending');
  assert.equal(onDisk.startedAt, '2026-01-01T00:00:00.000Z');
  assert.equal(onDisk.hash, 'h1');
});

test('skips when the hash is unchanged and updates when it changed', async () => {
  const mapPath = mapFile();
  const map = { version: 1, items: { pi: { state: 'synced', itemId: 'i9', url: 'u9', title: 'Pi', hash: 'h1' } } };
  const client = fakeClient();
  assert.equal((await runSync({ prepared: [item()], map, mapPath, client }))[0].action, 'skip');
  assert.deepEqual(client.calls, []);
  const r = await runSync({ prepared: [item('pi', 'h2')], map, mapPath, client });
  assert.equal(r[0].action, 'update');
  assert.deepEqual(client.calls, [['update', 'i9', 'Pi']]);
  assert.equal(loadMap(mapPath).items.pi.hash, 'h2');
});

test('a 5xx on create leaves pending, and the next run does not POST again (Review Focus 3)', async () => {
  const mapPath = mapFile();
  const map = emptyMap();
  const failing = fakeClient({ createItem: async () => { throw new QiitaApiError(503, undefined, 'down'); } });
  await assert.rejects(runSync({ prepared: [item()], map, mapPath, client: failing }), /down/);
  assert.equal(loadMap(mapPath).items.pi.state, 'pending');
  const again = fakeClient();
  await assert.rejects(runSync({ prepared: [item()], map: loadMap(mapPath), mapPath, client: again }), /no matching Qiita item/);
  assert.deepEqual(again.calls, []);
});

test('a 201 without an id leaves pending (Review Focus 3)', async () => {
  const mapPath = mapFile();
  const client = fakeClient({ createItem: async () => ({}) });
  await assert.rejects(runSync({ prepared: [item()], map: emptyMap(), mapPath, client }), QiitaNetworkError);
  assert.equal(loadMap(mapPath).items.pi.state, 'pending');
});

test('a network error on create leaves pending', async () => {
  const mapPath = mapFile();
  const client = fakeClient({ createItem: async () => { throw new QiitaNetworkError('reset'); } });
  await assert.rejects(runSync({ prepared: [item()], map: emptyMap(), mapPath, client }));
  assert.equal(loadMap(mapPath).items.pi.state, 'pending');
});

test('a 4xx on create removes the pending entry', async () => {
  const mapPath = mapFile();
  const client = fakeClient({ createItem: async () => { throw new QiitaApiError(401, 'unauthorized', 'nope'); } });
  await assert.rejects(runSync({ prepared: [item()], map: emptyMap(), mapPath, client }), /nope/);
  assert.deepEqual(loadMap(mapPath).items, {});
});

test('an interrupted unpublish blocks syncing that slug', async () => {
  const map = { version: 1, items: { pi: { state: 'unpublishing', itemId: 'i', url: 'u', title: 'Pi', hash: 'h1' } } };
  await assert.rejects(run({ map }), /unpublish was interrupted/);
});

test('planSync reports the action per slug without any I/O', () => {
  const map = {
    version: 1,
    items: {
      same: { state: 'synced', itemId: '1', url: 'u', title: 't', hash: 'h' },
      changed: { state: 'synced', itemId: '2', url: 'u', title: 't', hash: 'old' },
      stuck: { state: 'pending', title: 't', hash: 'h' },
      gone: { state: 'unpublishing', itemId: '3', url: 'u', title: 't', hash: 'h' },
    },
  };
  const plan = planSync(['new', 'same', 'changed', 'stuck', 'gone'].map((s) => item(s, s === 'changed' ? 'new' : 'h')), map);
  assert.deepEqual(plan.map((p) => p.action), ['create', 'skip', 'update', 'recover', 'blocked']);
});
