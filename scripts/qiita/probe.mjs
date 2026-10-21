// Step-0 live probe. Creates ONE limited-sharing item from a fixture, walks you through checking it,
// optionally deletes it. Never touches blog posts or the map.
//   QIITA_TOKEN=... node scripts/qiita/probe.mjs scripts/qiita/fixtures/probe.md --svg-url <public https SVG URL>
import { readFileSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { parseArgs } from 'node:util';
import { createClient } from './client.mjs';

const { values, positionals } = parseArgs({ allowPositionals: true, options: { 'svg-url': { type: 'string' } } });
const [fixture] = positionals;
if (!fixture || !values['svg-url'] || !process.env.QIITA_TOKEN) {
  console.error('usage: QIITA_TOKEN=... node scripts/qiita/probe.mjs <fixture.md> --svg-url <public https SVG URL>');
  process.exit(2);
}

const rl = createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => rl.question(`\n${q}\n> `);
const client = createClient({ token: process.env.QIITA_TOKEN });
const results = [];
const record = (key, value) => {
  results.push([key, value]);
  console.log(`  ${key}: ${value}`);
};
const attempt = async (label, fn) => {
  try {
    const r = await fn();
    record(label, 'ok');
    return r;
  } catch (e) {
    record(label, `FAILED ${e.message}`);
    return undefined;
  }
};

const body = readFileSync(fixture, 'utf8').replaceAll('{{SVG_URL}}', values['svg-url']);
const base = { title: `[probe] ${new Date().toISOString()}`, body, tags: [{ name: 'test', versions: [] }], private: true };
let item;
try {
  await attempt('auth (GET /authenticated_user with Bearer header)', () => client.getAuthenticatedUser());
  item = await attempt('create (POST, private: true)', () => client.createItem(base));
  if (!item) process.exitCode = 1;
  else {
    console.log(`\nItem: ${item.url}`);
    record('response.private', String(item.private));
    record('response.tags', JSON.stringify(item.tags));
    await ask('Open the URL in a LOGGED-OUT private window. Is it visible by URL? Does the SVG image render? Do :::note, the div/span and mermaid render? Note your answers, then press Enter.');
    await ask('While logged out, search Qiita for the probe title. Does it appear? Note it, then press Enter.');
    await attempt('update (PATCH title + body)', () => client.updateItem(item.id, { ...base, title: `${base.title} (patched)` }));
    const items = await attempt('list own items (GET /authenticated_user/items)', () => client.listMyItems());
    if (items) record('listing contains the probe item', String(items.some((i) => i.id === item.id)));
    await attempt('6 tags (a rejection means the limit is 5)', () =>
      client.updateItem(item.id, { ...base, tags: ['a', 'b', 'c', 'd', 'e', 'f'].map((name) => ({ name, versions: [] })) }),
    );
    await attempt('tag with a space and punctuation', () => client.updateItem(item.id, { ...base, tags: [{ name: 'a b!', versions: [] }] }));
  }
} finally {
  if (item) {
    const answer = await ask(`Delete probe item ${item.id}? (y/N)`);
    if (answer.trim().toLowerCase() === 'y') await attempt('delete (DELETE)', () => client.deleteItem(item.id));
    else console.log(`Left in place: ${item.url}. Delete it on Qiita yourself.`);
  }
  rl.close();
  console.log(`\nRecord these in docs/maintenance.md (Qiita sync, probe results):\n${results.map(([k, v]) => `- ${k}: ${v}`).join('\n')}`);
}
