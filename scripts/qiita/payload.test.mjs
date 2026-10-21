import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { buildPayload, canonicalJson, hashPayload, normalizeBody, normalizeTags } from './payload.mjs';

const base = { title: 'T', body: 'hello\n', tags: ['a', 'b'], visibility: 'limited' };

test('normalizeBody uses LF, trims trailing whitespace, ends with one newline', () => {
  assert.equal(normalizeBody('a  \r\nb\t\r\n\r\n\r\n'), 'a\nb\n');
});

test('normalizeTags trims, drops empties, dedupes case-insensitively, keeps order', () => {
  assert.deepEqual(normalizeTags([' Pi ', '', 'pi', 'AI']), ['Pi', 'AI']);
});

test('normalizeTags rejects zero tags and more than five', () => {
  assert.throws(() => normalizeTags([]), /at least one tag/);
  assert.throws(() => normalizeTags(['a', 'b', 'c', 'd', 'e', 'f']), /at most 5/);
});

test('buildPayload maps visibility to private and shapes tags', () => {
  assert.equal(buildPayload(base).private, true);
  assert.equal(buildPayload({ ...base, visibility: 'public' }).private, false);
  assert.deepEqual(buildPayload(base).tags, [{ name: 'a', versions: [] }, { name: 'b', versions: [] }]);
  assert.throws(() => buildPayload({ ...base, visibility: 'secret' }), /visibility/);
  assert.throws(() => buildPayload({ ...base, title: '  ' }), /title/);
});

test('canonicalJson sorts keys at every depth', () => {
  assert.equal(canonicalJson({ b: 1, a: { d: [2, { z: 1, y: 2 }], c: 3 } }), '{"a":{"c":3,"d":[2,{"y":2,"z":1}]},"b":1}');
});

test('hash is the v1-prefixed sha256 of the canonical payload and ignores key order', () => {
  const p = buildPayload(base);
  const expected = createHash('sha256').update(`v1:${canonicalJson(p)}`).digest('hex');
  assert.equal(hashPayload(p), expected);
  const shuffled = { private: p.private, tags: p.tags, body: p.body, title: p.title };
  assert.equal(hashPayload(shuffled), expected);
});

test('hash changes when any payload field changes', () => {
  const h = hashPayload(buildPayload(base));
  assert.notEqual(h, hashPayload(buildPayload({ ...base, title: 'T2' })));
  assert.notEqual(h, hashPayload(buildPayload({ ...base, body: 'bye\n' })));
  assert.notEqual(h, hashPayload(buildPayload({ ...base, tags: ['a'] })));
  assert.notEqual(h, hashPayload(buildPayload({ ...base, visibility: 'public' })));
});
