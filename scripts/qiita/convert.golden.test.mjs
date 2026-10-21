import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { BLOG_DIR, DIST_DIR, SITE_URL } from './config.mjs';
import { convertBody, makePageExists } from './convert.mjs';
import { describePost } from './posts.mjs';

const SLUG = 'pi-agent-freedom-vs-convenience';
const builtFile = path.join(DIST_DIR, 'ja', 'blog', SLUG, 'index.html');
const sourceFile = path.join(BLOG_DIR, 'ja', `${SLUG}.md`);

test('real Japanese Pi article converts cleanly', { skip: !existsSync(builtFile) && 'run `npm run build` first' }, () => {
  const post = describePost(`ja/${SLUG}`, readFileSync(sourceFile, 'utf8'), sourceFile);
  const { markdown, assetUrls, warnings } = convertBody(post.body, {
    canonicalUrl: `${SITE_URL}/ja/blog/${SLUG}/`,
    siteUrl: SITE_URL,
    builtHtml: readFileSync(builtFile, 'utf8'),
    pageExists: makePageExists(DIST_DIR),
  });
  assert.equal(assetUrls.length, 8);
  assert.ok(assetUrls.every((u) => /^https:\/\/hdquangsgt\.github\.io\/diagrams\/[a-z-]+\.svg$/.test(u)));
  assert.doesNotMatch(markdown, /!\[[^\]]*\]\([^)]*\.svg\)/);
  assert.doesNotMatch(markdown, /<div|<span/);
  assert.equal((markdown.match(/^:::note info$/gm) ?? []).length, 33);
  assert.equal((markdown.match(/^:::$/gm) ?? []).length, 33);
  assert.equal((markdown.match(/^> \[図を開く \(SVG\)\]/gm) ?? []).length, 8);
  assert.ok(markdown.endsWith(`元記事: ${SITE_URL}/ja/blog/${SLUG}/\n`));
  assert.deepEqual(warnings, []);
});
