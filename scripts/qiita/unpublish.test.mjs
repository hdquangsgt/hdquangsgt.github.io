import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { QiitaApiError } from './client.mjs';
import { loadMap, saveMap } from './map.mjs';
import { unpublish } from './sync.mjs';

const mapFile = () => path.join(mkdtempSync(path.join(os.tmpdir(), 'qiita-unpub-')), 'map.json');
const entry = (over = {}) => ({ state: 'synced', itemId: 'abc', url: 'https://qiita.com/u/items/abc', title: 'Pi', hash: 'h', ...over });
const remote = (over = {}) => ({ id: 'abc', url: 'https://qiita.com/u/items/abc', title: 'Pi', user: { id: 'me' }, ...over });
function setup({ remoteItem = remote(), over = {} } = {}) {
  const mapPath = mapFile();
  const map = { version: 1, items: { pi: entry() } };
  saveMap(mapPath, map);
  const calls = [];
  const client = {
    calls,
    getItem: async () => (typeof remoteItem === 'function' ? remoteItem() : remoteItem),
    getAuthenticatedUser: async () => ({ id: 'me' }),
    deleteItem: async (id) => void calls.push(`delete:${id}`),
    ...over,
  };
  return { mapPath, map, client, args: { slug: 'pi', confirm: 'pi', allowlist: ['pi'], map, mapPath, client } };
}

test('deletes a validated item and removes it from the map', async () => {
  const { mapPath, client, args } = setup();
  assert.deepEqual(await unpublish(args), { status: 'deleted' });
  assert.deepEqual(client.calls, ['delete:abc']);
  assert.deepEqual(loadMap(mapPath).items, {});
});

test('marks unpublishing on disk while the DELETE is in flight', async () => {
  let during;
  const { mapPath, args } = setup();
  args.client.deleteItem = async () => { during = JSON.parse(readFileSync(mapPath, 'utf8')).items.pi.state; };
  await unpublish(args);
  assert.equal(during, 'unpublishing');
});

test('a failed DELETE leaves the entry as unpublishing', async () => {
  const { mapPath, args } = setup({ over: { deleteItem: async () => { throw new QiitaApiError(500, undefined, 'boom'); } } });
  await assert.rejects(unpublish(args), /boom/);
  assert.equal(loadMap(mapPath).items.pi.state, 'unpublishing');
});

test('refuses on any mismatch and deletes nothing', async () => {
  for (const [name, remoteItem, pattern] of [
    ['id', remote({ id: 'zzz' }), /id/],
    ['url', remote({ url: 'https://qiita.com/u/items/other' }), /url/],
    ['title', remote({ title: 'Edited on Qiita' }), /title/],
    ['owner', remote({ user: { id: 'someone' } }), /owner/],
  ]) {
    const { mapPath, client, args } = setup({ remoteItem });
    await assert.rejects(unpublish(args), pattern, name);
    assert.deepEqual(client.calls, [], name);
    assert.equal(loadMap(mapPath).items.pi.state, 'synced', name);
  }
});

test('requires the allowlist, a matching --confirm, and a synced entry', async () => {
  const { args } = setup();
  await assert.rejects(unpublish({ ...args, slug: 'welcome', confirm: 'welcome' }), /allowlist/);
  await assert.rejects(unpublish({ ...args, confirm: 'other' }), /--confirm/);
  await assert.rejects(unpublish({ ...args, confirm: undefined }), /--confirm/);
  await assert.rejects(unpublish({ ...args, map: { version: 1, items: {} } }), /no synced Qiita item/);
  await assert.rejects(unpublish({ ...args, map: { version: 1, items: { pi: { state: 'pending', title: 'Pi', hash: 'h' } } } }), /no synced Qiita item/);
});

test('a 404 on GET means already gone: the entry is removed, nothing is deleted', async () => {
  const { mapPath, client, args } = setup({ remoteItem: () => { throw new QiitaApiError(404, 'not_found', 'gone'); } });
  assert.deepEqual(await unpublish(args), { status: 'already-gone' });
  assert.deepEqual(client.calls, []);
  assert.deepEqual(loadMap(mapPath).items, {});
});

test('a 404 on DELETE after validation is treated as deleted', async () => {
  const { mapPath, args } = setup({ over: { deleteItem: async () => { throw new QiitaApiError(404, 'not_found', 'gone'); } } });
  assert.deepEqual(await unpublish(args), { status: 'deleted' });
  assert.deepEqual(loadMap(mapPath).items, {});
});
