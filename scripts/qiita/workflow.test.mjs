import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';
import { REPO_ROOT } from './config.mjs';

const wf = parse(readFileSync(path.join(REPO_ROOT, '.github/workflows/qiita-sync.yml'), 'utf8'));

test('real runs happen only on main: manual dispatch there, or after a successful push-deploy of main', () => {
  const cond = wf.jobs.apply.if;
  assert.match(cond, /github\.ref == 'refs\/heads\/main'/);
  assert.match(cond, /!inputs\.dry_run/);
  assert.match(cond, /workflow_run\.conclusion == 'success'/);
  assert.match(cond, /workflow_run\.head_branch == 'main'/);
  assert.match(cond, /workflow_run\.event == 'push'/);
  assert.deepEqual(wf.on.workflow_run, { workflows: ['Deploy to GitHub Pages'], types: ['completed'], branches: ['main'] });
  const checkout = wf.jobs.apply.steps.find((s) => s.uses?.startsWith('actions/checkout'));
  assert.match(checkout.with.ref, /workflow_run\.head_sha/);
});

test('dry-run and the wrong-branch guard only react to manual dispatch', () => {
  assert.match(wf.jobs['dry-run'].if, /workflow_dispatch/);
  assert.match(wf.jobs['dry-run'].if, /inputs\.dry_run/);
  const guard = wf.jobs['wrong-branch'];
  assert.match(guard.if, /workflow_dispatch/);
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
