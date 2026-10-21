import test from 'node:test';
import assert from 'node:assert/strict';
import { describePost } from './posts.mjs';
import { assertAllowlisted, assertNotFlagged, findOrphans, selectPosts } from './select.mjs';

const mk = (id, data) => describePost(id, `---\n${JSON.stringify({ title: 'T', pubDate: '2026-01-01', ...data })}\n---\nbody\n`, id);
const NOW = new Date('2026-06-01T00:00:00Z');
const ALLOW = ['pi'];
const flagged = { qiita: { publish: true } };

test('publishes only flagged, allowlisted ja posts', () => {
  const r = selectPosts([mk('ja/pi', flagged)], ALLOW, NOW);
  assert.deepEqual(r.eligible.map((p) => p.slug), ['pi']);
  assert.deepEqual(r.errors, []);
});

test('allowlist alone publishes nothing', () => {
  const r = selectPosts([mk('ja/pi', {})], ALLOW, NOW);
  assert.equal(r.eligible.length, 0);
  assert.equal(r.errors.length, 0);
});

test('publish false or absent is ignored without error', () => {
  const r = selectPosts([mk('ja/pi', { qiita: { publish: false } }), mk('ja/welcome', {})], ALLOW, NOW);
  assert.deepEqual(r, { eligible: [], skipped: [], errors: [] });
});

test('flag on a non-ja post is an error', () => {
  const r = selectPosts([mk('pi', flagged), mk('vi/pi', flagged)], ALLOW, NOW);
  assert.equal(r.errors.length, 2);
  assert.match(r.errors[0], /only allowed on ja posts/);
  assert.equal(r.eligible.length, 0);
});

test('flag on a non-allowlisted ja post is an error', () => {
  const r = selectPosts([mk('ja/welcome', flagged)], ALLOW, NOW);
  assert.match(r.errors[0], /not in scripts\/qiita\/allowlist\.json/);
  assert.equal(r.eligible.length, 0);
});

test('drafts and scheduled posts are skipped with a reason', () => {
  const r = selectPosts(
    [mk('ja/pi', { ...flagged, draft: true }), mk('ja/pi', { ...flagged, pubDate: '2027-01-01T00:00:00Z' })],
    ALLOW,
    NOW,
  );
  assert.deepEqual(r.skipped.map((s) => s.reason), ['draft', 'scheduled']);
  assert.equal(r.eligible.length, 0);
});

test('findOrphans lists mapped slugs that are no longer flagged', () => {
  const map = { version: 1, items: { pi: {}, old: {} } };
  assert.deepEqual(findOrphans([mk('ja/pi', flagged), mk('ja/old', {})], map), ['old']);
});

test('assertAllowlisted and assertNotFlagged', () => {
  assert.throws(() => assertAllowlisted('welcome', ALLOW), /not in scripts\/qiita\/allowlist\.json/);
  assert.doesNotThrow(() => assertAllowlisted('pi', ALLOW));
  assert.throws(() => assertNotFlagged([mk('ja/pi', flagged)], 'pi'), /qiita\.publish: false/);
  assert.doesNotThrow(() => assertNotFlagged([mk('ja/pi', {})], 'pi'));
});
