import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { main } from './cli.mjs';

const SITE = 'https://example.test';

function project({ frontmatter = { qiita: { publish: true } }, withDist = true, map } = {}) {
  const root = mkdtempSync(path.join(os.tmpdir(), 'qiita-cli-'));
  mkdirSync(path.join(root, 'blog/ja'), { recursive: true });
  const fm = { title: 'Pi', pubDate: '2026-01-01', tags: ['pi'], ...frontmatter };
  writeFileSync(path.join(root, 'blog/ja/pi.md'), `---\n${JSON.stringify(fm)}\n---\n\n![Diagram](../images/d.svg)\n\nHello\n`);
  if (withDist) {
    mkdirSync(path.join(root, 'dist/ja/blog/pi'), { recursive: true });
    writeFileSync(
      path.join(root, 'dist/ja/blog/pi/index.html'),
      '<html><div class="prose"><img alt="Diagram" src="/_astro/d.H.svg"></div><footer class="article-footer"></footer></html>',
    );
  }
  writeFileSync(path.join(root, 'allowlist.json'), JSON.stringify(['pi']));
  const mapPath = path.join(root, 'map.json');
  if (map) writeFileSync(mapPath, JSON.stringify(map));
  const calls = [];
  const logs = [];
  const errs = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push(`${init.method ?? 'GET'} ${url}`);
    const json = (b, s = 200) => new Response(JSON.stringify(b), { status: s });
    if (init.method === 'HEAD') return new Response(null, { status: 200 });
    if (init.method === 'POST') return json({ id: 'item1', url: 'https://qiita.com/u/items/item1' }, 201);
    if (url.endsWith('/authenticated_user')) return json({ id: 'me' });
    if (url.endsWith('/items/item1') && init.method === 'DELETE') return new Response(null, { status: 204 });
    if (url.endsWith('/items/item1')) return json({ id: 'item1', url: 'https://qiita.com/u/items/item1', title: 'Pi', user: { id: 'me' } });
    return json({ message: 'unexpected' }, 500);
  };
  const deps = {
    blogDir: path.join(root, 'blog'),
    distDir: path.join(root, 'dist'),
    mapPath,
    allowlistPath: path.join(root, 'allowlist.json'),
    previewDir: path.join(root, 'preview'),
    siteUrl: SITE,
    fetchImpl,
    log: (m) => logs.push(m),
    err: (m) => errs.push(m),
  };
  return { root, deps, calls, logs, errs, mapPath };
}

test('dry-run (the default) makes no network call, writes a preview, and leaves the map alone', async () => {
  const p = project();
  assert.equal(await main([], { QIITA_TOKEN: 'tok' }, p.deps), 0);
  assert.deepEqual(p.calls, []);
  assert.equal(existsSync(p.mapPath), false);
  const preview = readFileSync(path.join(p.deps.previewDir, 'pi.md'), 'utf8');
  assert.match(preview, /^!\[Diagram\]\(https:\/\/example\.test\/_astro\/d\.H\.svg\)$/m);
  assert.doesNotMatch(preview, /図を開く/);
  assert.match(p.logs.join('\n'), /pi: create/);
});

test('--apply preflights assets, creates the item, saves the map and reports map_changed', async () => {
  const p = project();
  const out = path.join(p.root, 'gh-output');
  assert.equal(await main(['--apply'], { QIITA_TOKEN: 'tok', GITHUB_OUTPUT: out }, p.deps), 0);
  assert.deepEqual(p.calls, [`HEAD ${SITE}/_astro/d.H.svg`, 'POST https://qiita.com/api/v2/items']);
  assert.equal(JSON.parse(readFileSync(p.mapPath, 'utf8')).items.pi.itemId, 'item1');
  assert.match(readFileSync(out, 'utf8'), /map_changed=true/);
  p.calls.length = 0;
  assert.equal(await main(['--apply'], { QIITA_TOKEN: 'tok', GITHUB_OUTPUT: out }, p.deps), 0);
  assert.deepEqual(p.calls, [`HEAD ${SITE}/_astro/d.H.svg`]);
  assert.match(readFileSync(out, 'utf8'), /map_changed=false/);
});

test('--apply without a token fails before any request', async () => {
  const p = project();
  assert.equal(await main(['--apply'], {}, p.deps), 1);
  assert.deepEqual(p.calls, []);
  assert.match(p.errs.join('\n'), /QIITA_TOKEN/);
});

test('a flagged post that is not allowlisted fails the whole run', async () => {
  const p = project();
  writeFileSync(p.deps.allowlistPath, '[]');
  assert.equal(await main(['--apply'], { QIITA_TOKEN: 'tok' }, p.deps), 1);
  assert.deepEqual(p.calls, []);
  assert.match(p.errs.join('\n'), /allowlist/);
});

test('a flagged post without a built page tells you to build (Review Focus 5)', async () => {
  const p = project({ withDist: false });
  assert.equal(await main([], {}, p.deps), 1);
  assert.match(p.errs.join('\n'), /npm run build/);
});

test('an unflagged post publishes nothing', async () => {
  const p = project({ frontmatter: {} });
  assert.equal(await main(['--apply'], { QIITA_TOKEN: 'tok' }, p.deps), 0);
  assert.deepEqual(p.calls, []);
});

test('orphans are reported but never deleted', async () => {
  const map = { version: 1, items: { pi: { state: 'synced', itemId: 'item1', url: 'u', title: 'Pi', hash: 'h' } } };
  const p = project({ frontmatter: { qiita: { publish: false } }, map });
  assert.equal(await main(['--apply'], { QIITA_TOKEN: 'tok' }, p.deps), 0);
  assert.match(p.logs.join('\n'), /pi.*still on Qiita.*--unpublish/);
  assert.deepEqual(p.calls, []);
});

test('--unpublish refuses while the post is still flagged', async () => {
  const map = { version: 1, items: { pi: { state: 'synced', itemId: 'item1', url: 'https://qiita.com/u/items/item1', title: 'Pi', hash: 'h' } } };
  const p = project({ map });
  assert.equal(await main(['--apply', '--unpublish', 'pi', '--confirm', 'pi'], { QIITA_TOKEN: 'tok' }, p.deps), 1);
  assert.match(p.errs.join('\n'), /qiita\.publish: false/);
  assert.deepEqual(p.calls, []);
});

test('--unpublish without --apply only prints what it would do', async () => {
  const map = { version: 1, items: { pi: { state: 'synced', itemId: 'item1', url: 'https://qiita.com/u/items/item1', title: 'Pi', hash: 'h' } } };
  const p = project({ frontmatter: {}, map });
  assert.equal(await main(['--unpublish', 'pi', '--confirm', 'pi'], { QIITA_TOKEN: 'tok' }, p.deps), 0);
  assert.deepEqual(p.calls, []);
  assert.match(p.logs.join('\n'), /dry-run: would delete/);
});

test('--apply --unpublish deletes the validated item and clears the map', async () => {
  const map = { version: 1, items: { pi: { state: 'synced', itemId: 'item1', url: 'https://qiita.com/u/items/item1', title: 'Pi', hash: 'h' } } };
  const p = project({ frontmatter: {}, map });
  assert.equal(await main(['--apply', '--unpublish', 'pi', '--confirm', 'pi'], { QIITA_TOKEN: 'tok' }, p.deps), 0);
  assert.ok(p.calls.includes('DELETE https://qiita.com/api/v2/items/item1'));
  assert.deepEqual(JSON.parse(readFileSync(p.mapPath, 'utf8')).items, {});
});

test('errors never print the token', async () => {
  const p = project();
  p.deps.fetchImpl = async (url, init = {}) =>
    init.method === 'HEAD' ? new Response(null, { status: 200 }) : new Response(JSON.stringify({ message: 'bad tok-secret' }), { status: 401 });
  assert.equal(await main(['--apply'], { QIITA_TOKEN: 'tok-secret' }, p.deps), 1);
  assert.doesNotMatch(p.errs.join('\n'), /tok-secret/);
});

test('a local --apply that changes the map reminds you to commit it (duplicate guard)', async () => {
  const p = project();
  assert.equal(await main(['--apply'], { QIITA_TOKEN: 'tok' }, p.deps), 0);
  assert.match(p.logs.join('\n'), /commit and push scripts\/qiita-map\.json/);
  const ci = project();
  assert.equal(await main(['--apply'], { QIITA_TOKEN: 'tok', GITHUB_OUTPUT: path.join(ci.root, 'out') }, ci.deps), 0);
  assert.doesNotMatch(ci.logs.join('\n'), /commit and push/);
});

test('--svg link switches to the text-caption fallback', async () => {
  const p = project();
  assert.equal(await main(['--svg', 'link'], {}, p.deps), 0);
  assert.match(readFileSync(path.join(p.deps.previewDir, 'pi.md'), 'utf8'), /図を開く/);
});
