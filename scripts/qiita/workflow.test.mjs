import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';
import { REPO_ROOT } from './config.mjs';

const wf = parse(readFileSync(path.join(REPO_ROOT, '.github/workflows/qiita-sync.yml'), 'utf8'));

test('real runs are only possible from main, so the map is never committed to another branch', () => {
  assert.match(wf.jobs.apply.if, /github\.ref == 'refs\/heads\/main'/);
  assert.match(wf.jobs.apply.if, /!inputs\.dry_run/);
  const guard = wf.jobs['wrong-branch'];
  assert.ok(guard, 'a job must fail loudly when a real run is dispatched elsewhere');
  assert.match(guard.if, /github\.ref != 'refs\/heads\/main'/);
  assert.equal(guard.permissions?.contents, 'read');
});

test('only the apply job sees the token and only commit-map can push', () => {
  assert.match(JSON.stringify(wf.jobs.apply), /secrets\.QIITA_TOKEN/);
  assert.doesNotMatch(JSON.stringify(wf.jobs['dry-run']), /QIITA_TOKEN/);
  assert.doesNotMatch(JSON.stringify(wf.jobs['commit-map']), /QIITA_TOKEN/);
  assert.equal(wf.jobs['commit-map'].permissions.contents, 'write');
  assert.equal(wf.jobs.apply.permissions.contents, 'read');
});
