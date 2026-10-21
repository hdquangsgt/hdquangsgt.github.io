import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describePost, loadPosts, parseFrontmatter } from './posts.mjs';

const doc = (data, body = 'body\n') => `---\n${JSON.stringify(data)}\n---\n${body}`;

test('parseFrontmatter splits data and body, including CRLF files', () => {
  const { data, body } = parseFrontmatter('---\r\ntitle: A\r\ntags: [x, y]\r\n---\r\nhello\r\n');
  assert.deepEqual(data, { title: 'A', tags: ['x', 'y'] });
  assert.equal(body, 'hello\r\n');
});

test('parseFrontmatter throws without frontmatter', () => {
  assert.throws(() => parseFrontmatter('no frontmatter'), /frontmatter/);
});

test('describePost derives lang and slug from the id', () => {
  assert.deepEqual(
    (({ lang, slug }) => ({ lang, slug }))(describePost('ja/pi', doc({ title: 'x' }), 'f')),
    { lang: 'ja', slug: 'pi' },
  );
  assert.equal(describePost('pi', doc({ title: 'x' }), 'f').lang, 'en');
  assert.equal(describePost('vi/pi', doc({ title: 'x' }), 'f').slug, 'pi');
});

test('loadPosts reads markdown recursively and ignores other files', () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'qiita-posts-'));
  mkdirSync(path.join(dir, 'ja'));
  mkdirSync(path.join(dir, 'images'));
  writeFileSync(path.join(dir, 'a.md'), doc({ title: 'A' }));
  writeFileSync(path.join(dir, 'ja', 'b.md'), doc({ title: 'B' }));
  writeFileSync(path.join(dir, 'images', 'x.svg'), '<svg/>');
  const posts = loadPosts(dir);
  assert.deepEqual(posts.map((p) => p.id), ['a', 'ja/b']);
});
