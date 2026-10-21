import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { REPO_ROOT, SITE_URL } from './config.mjs';

test('SITE_URL matches astro.config.mjs', () => {
  const astro = readFileSync(path.join(REPO_ROOT, 'astro.config.mjs'), 'utf8');
  assert.match(astro, new RegExp(`site: '${SITE_URL}'`));
});
