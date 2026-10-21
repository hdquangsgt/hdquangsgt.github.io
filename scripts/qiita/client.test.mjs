import test from 'node:test';
import assert from 'node:assert/strict';
import { createClient, DryRunError, isDefinitiveFailure, QiitaApiError, QiitaNetworkError, redact } from './client.mjs';

const TOKEN = 'secret-token-123';
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
function fake(responder) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    return responder(url, init, calls.length);
  };
  return { calls, fetchImpl };
}

test('sends Bearer auth and JSON body to the right URL', async () => {
  const { calls, fetchImpl } = fake(() => json({ id: 'x', url: 'u' }, 201));
  const client = createClient({ token: TOKEN, fetchImpl });
  await client.createItem({ title: 'T' });
  assert.equal(calls[0].url, 'https://qiita.com/api/v2/items');
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(calls[0].init.headers.Authorization, `Bearer ${TOKEN}`);
  assert.equal(calls[0].init.body, '{"title":"T"}');
});

test('dry-run throws on any non-GET before touching the network', async () => {
  const { calls, fetchImpl } = fake(() => json({}));
  const client = createClient({ token: TOKEN, fetchImpl, dryRun: true });
  await assert.rejects(client.createItem({}), DryRunError);
  await assert.rejects(client.updateItem('a', {}), DryRunError);
  await assert.rejects(client.deleteItem('a'), DryRunError);
  assert.equal(calls.length, 0);
  await client.getItem('a');
  assert.equal(calls.length, 1);
});

test('requires a token', async () => {
  const client = createClient({ token: '', fetchImpl: async () => json({}) });
  await assert.rejects(client.getItem('a'), /QIITA_TOKEN/);
});

test('4xx is a definitive API error; 5xx is not', async () => {
  const c4 = createClient({ token: TOKEN, fetchImpl: async () => json({ message: 'bad', type: 'unauthorized' }, 401) });
  const e4 = await c4.createItem({}).catch((e) => e);
  assert.ok(e4 instanceof QiitaApiError);
  assert.equal(e4.status, 401);
  assert.equal(e4.type, 'unauthorized');
  assert.equal(isDefinitiveFailure(e4), true);
  const c5 = createClient({ token: TOKEN, fetchImpl: async () => json({ message: 'oops' }, 503) });
  assert.equal(isDefinitiveFailure(await c5.createItem({}).catch((e) => e)), false);
});

test('network errors and unparseable success bodies are ambiguous network errors', async () => {
  const down = createClient({ token: TOKEN, fetchImpl: async () => { throw new Error('ECONNRESET'); } });
  const e1 = await down.createItem({}).catch((e) => e);
  assert.ok(e1 instanceof QiitaNetworkError);
  assert.equal(isDefinitiveFailure(e1), false);
  const garbage = createClient({ token: TOKEN, fetchImpl: async () => new Response('<html>', { status: 201 }) });
  assert.ok((await garbage.createItem({}).catch((e) => e)) instanceof QiitaNetworkError);
});

test('errors never contain the token', async () => {
  const c = createClient({ token: TOKEN, fetchImpl: async () => json({ message: `bad token ${TOKEN}` }, 401) });
  const e = await c.createItem({}).catch((err) => err);
  assert.doesNotMatch(e.message, new RegExp(TOKEN));
  assert.equal(redact(`a ${TOKEN} b`, TOKEN), 'a *** b');
});

test('DELETE with an empty 204 body succeeds', async () => {
  const c = createClient({ token: TOKEN, fetchImpl: async () => new Response(null, { status: 204 }) });
  assert.equal(await c.deleteItem('a'), undefined);
});

test('listMyItems pages until a short page', async () => {
  const page = (n) => Array.from({ length: n }, (_, i) => ({ id: String(i) }));
  const { calls, fetchImpl } = fake((url, _init, n) => json(n === 1 ? page(100) : page(3)));
  const items = await createClient({ token: TOKEN, fetchImpl }).listMyItems();
  assert.equal(items.length, 103);
  assert.match(calls[0].url, /\/authenticated_user\/items\?page=1&per_page=100$/);
  assert.match(calls[1].url, /page=2/);
});
