import test from 'node:test';
import assert from 'node:assert/strict';
import { inlineSvg } from './inline-svg.mjs';

const SOURCE = `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="5" viewBox="0 0 10 5">
  <style>
    .bg { fill: var(--color-bg, #ffffff); }
    .a, .b { stroke: #111; }
    @media (prefers-color-scheme: dark) {
      .bg { fill: var(--color-bg, #000000); }
      .a, .b { stroke: #eee; }
    }
  </style>
  <defs><marker id="m"><path d="M0 0"/></marker></defs>
  <rect class="bg" width="10" height="5"/><path class="a" marker-end="url(#m)" d="M0 0"/>
</svg>`;

const out = inlineSvg(SOURCE, { id: 'dg7', label: 'A "diagram" <1>', src: '/diagrams/x.svg' });

test('light rules are scoped to the diagram', () => {
  assert.match(out, /\.dg7 \.bg \{ fill: var\(--color-bg, #ffffff\); \}/);
  assert.match(out, /\.dg7 \.a, \.dg7 \.b \{ stroke: #111; \}/);
});

test('the prefers-color-scheme block follows the site theme attribute instead', () => {
  assert.doesNotMatch(out, /@media|prefers-color-scheme/);
  assert.match(out, /:root\[data-theme="dark"\] \.dg7 \.bg \{ fill: var\(--color-bg, #000000\); \}/);
  assert.match(out, /:root\[data-theme="dark"\] \.dg7 \.a, :root\[data-theme="dark"\] \.dg7 \.b \{ stroke: #eee; \}/);
});

test('ids and references get a per-diagram prefix', () => {
  assert.match(out, /id="dg7-m"/);
  assert.match(out, /url\(#dg7-m\)/);
  assert.doesNotMatch(out, /id="m"|url\(#m\)/);
});

test('the diagram is one labelled image that records its standalone file', () => {
  assert.match(out, /^<svg class="diagram dg7" role="img" aria-label="A &quot;diagram&quot; &lt;1&gt;" data-diagram-src="\/diagrams\/x\.svg"/);
  assert.match(out, /viewBox="0 0 10 5"/);
});

test('unsupported CSS fails loudly instead of leaking page-wide styles', () => {
  const bad = SOURCE.replace('</style>', '@media (min-width: 1px) { .a { fill: red } } </style>');
  assert.throws(() => inlineSvg(bad, { id: 'dg1', label: '', src: 'x' }), /at-rule|dark @media/);
});
