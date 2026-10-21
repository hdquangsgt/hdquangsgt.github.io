import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadMap, saveMap } from './map.mjs';
import { checkRenames, preflightAssets, RecoveryRequiredError, recoverManual, runSync } from './sync.mjs';

const mapFile = () => path.join(mkdtempSync(path.join(os.tmpdir(), 'qiita-rec-')), 'map.json');
const item = (slug = 'pi', hash = 'h1', title = 'Pi') => ({ slug, title, hash, payload: { title, body: 'b\n', tags: [{ name: 'a', versions: [] }], private: true } });
const pendingMap = (over = {}) => ({ version: 1, items: { pi: { state: 'pending', title: 'Pi', hash: 'h1', startedAt: '2026-01-01T00:00:00.000Z', ...over } } });
const remote = (id, over = {}) => ({ id, url: `https://qiita.com/u/items/${id}`, title: 'Pi', created_at: '2026-01-01T00:00:30+00:00', user: { id: 'me' }, ...over });
function client(items = [], over = {}) {
  const calls = [];
  return {
    calls,
    createItem: async () => (calls.push('create'), { id: 'new', url: 'u' }),
    updateItem: async (id) => (calls.push(`update:${id}`), { id, url: `https://qiita.com/u/items/${id}` }),
    listMyItems: async () => items,
    getItem: async (id) => items.find((i) => i.id === id) ?? Promise.reject(new Error('404')),
    getAuthenticatedUser: async () => ({ id: 'me' }),
    ...over,
  };
}

test('pending with exactly one matching remote item is adopted without POSTing', async () => {
  const mapPath = mapFile();
  const c = client([remote('abc')]);
  const r = await runSync({ prepared: [item()], map: pendingMap(), mapPath, client: c });
  assert.equal(r[0].action, 'skip');
  assert.deepEqual(c.calls, []);
  assert.deepEqual(loadMap(mapPath).items.pi, { state: 'synced', itemId: 'abc', url: 'https://qiita.com/u/items/abc', title: 'Pi', hash: 'h1' });
});

test('an adopted item is updated when the content changed since the create', async () => {
  const c = client([remote('abc')]);
  const r = await runSync({ prepared: [item('pi', 'h2')], map: pendingMap(), mapPath: mapFile(), client: c });
  assert.equal(r[0].action, 'update');
  assert.deepEqual(c.calls, ['update:abc']);
});

test('items older than the pending start, or with another title, do not match', async () => {
  const c = client([remote('old', { created_at: '2025-01-01T00:00:00+00:00' }), remote('other', { title: 'Other' })]);
  await assert.rejects(runSync({ prepared: [item()], map: pendingMap(), mapPath: mapFile(), client: c }), (e) => e instanceof RecoveryRequiredError && /--recover pi/.test(e.message));
  assert.deepEqual(c.calls, []);
});

test('several candidates stop the run and list them', async () => {
  const c = client([remote('a1'), remote('a2')]);
  await assert.rejects(runSync({ prepared: [item()], map: pendingMap(), mapPath: mapFile(), client: c }), /several.*a1.*a2/s);
});

test('recoverManual --item-id verifies title and owner, then adopts', async () => {
  const mapPath = mapFile();
  const map = pendingMap();
  saveMap(mapPath, map);
  await recoverManual({ slug: 'pi', itemId: 'abc', allowlist: ['pi'], map, mapPath, client: client([remote('abc')]) });
  assert.equal(loadMap(mapPath).items.pi.itemId, 'abc');
  const map2 = pendingMap();
  await assert.rejects(recoverManual({ slug: 'pi', itemId: 'abc', allowlist: ['pi'], map: map2, mapPath, client: client([remote('abc', { title: 'X' })]) }), /title/);
  await assert.rejects(recoverManual({ slug: 'pi', itemId: 'abc', allowlist: ['pi'], map: pendingMap(), mapPath, client: client([remote('abc', { user: { id: 'someone' } })]) }), /owner/);
});

test('recoverManual --not-created clears pending; guards apply', async () => {
  const mapPath = mapFile();
  const map = pendingMap();
  saveMap(mapPath, map);
  await recoverManual({ slug: 'pi', notCreated: true, allowlist: ['pi'], map, mapPath, client: client() });
  assert.deepEqual(loadMap(mapPath).items, {});
  await assert.rejects(recoverManual({ slug: 'welcome', notCreated: true, allowlist: ['pi'], map: pendingMap(), mapPath, client: client() }), /allowlist/);
  await assert.rejects(recoverManual({ slug: 'pi', allowlist: ['pi'], map: pendingMap(), mapPath, client: client() }), /--item-id or --not-created/);
  await assert.rejects(recoverManual({ slug: 'pi', notCreated: true, allowlist: ['pi'], map: { version: 1, items: {} }, mapPath, client: client() }), /not pending/);
  const dup = { version: 1, items: { ...pendingMap().items, other: { state: 'synced', itemId: 'abc', url: 'u', title: 'O', hash: 'h' } } };
  await assert.rejects(recoverManual({ slug: 'pi', itemId: 'abc', allowlist: ['pi'], map: dup, mapPath, client: client([remote('abc')]) }), /already mapped/);
});

test('checkRenames flags a vanished slug whose title reappears under a new slug', () => {
  const map = { version: 1, items: { old: { state: 'synced', itemId: '1', url: 'u', title: 'Same', hash: 'h' } } };
  const eligible = [item('new', 'h', 'Same')];
  assert.throws(() => checkRenames({ map, eligible, allSlugs: new Set(['new']) }), /rename.*"old".*"new"/s);
  assert.doesNotThrow(() => checkRenames({ map, eligible, allSlugs: new Set(['new', 'old']) }));
  assert.doesNotThrow(() => checkRenames({ map, eligible: [item('new', 'h', 'Different')], allSlugs: new Set(['new']) }));
});

test('preflightAssets requires every unique URL to answer 200', async () => {
  const seen = [];
  const ok = async (u, init) => (seen.push([u, init.method]), { status: 200 });
  await preflightAssets(['https://x/a.svg', 'https://x/a.svg', 'https://x/b.svg'], ok);
  assert.deepEqual(seen, [['https://x/a.svg', 'HEAD'], ['https://x/b.svg', 'HEAD']]);
  const mixed = async (u) => (u.endsWith('b.svg') ? { status: 404 } : { status: 200 });
  await assert.rejects(preflightAssets(['https://x/a.svg', 'https://x/b.svg'], mixed, { delayMs: 0 }), /b\.svg -> 404/);
  await assert.rejects(preflightAssets(['https://x/a.svg'], async () => { throw new Error('offline'); }, { delayMs: 0 }), /offline/);
});

test('preflightAssets retries so a deploy that is still propagating does not fail the run', async () => {
  let n = 0;
  const flaky = async () => ({ status: ++n < 3 ? 404 : 200 });
  await preflightAssets(['https://x/a.svg'], flaky, { attempts: 3, delayMs: 0 });
  assert.equal(n, 3);
  let m = 0;
  const never = async () => (m++, { status: 404 });
  await assert.rejects(preflightAssets(['https://x/a.svg'], never, { attempts: 3, delayMs: 0 }), /a\.svg -> 404/);
  assert.equal(m, 3);
});
