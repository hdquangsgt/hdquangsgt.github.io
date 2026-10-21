import test from 'node:test';
import assert from 'node:assert/strict';
import { altKey, ConversionError, convertBody, decodeEntities, extractImages } from './convert.mjs';

const SITE = 'https://example.test';
const CANON = `${SITE}/ja/blog/post/`;
const page = (imgs = '') =>
  `<html><body><img alt="logo" src="/logo.png"><div class="prose">${imgs}<h2 id="sec">S</h2></div><footer class="article-footer"></footer></body></html>`;
const img = (alt, src) => `<img alt="${alt}" src="${src}">`;
const ctx = (over = {}) => ({ canonicalUrl: CANON, siteUrl: SITE, builtHtml: page(), pageExists: () => true, ...over });

test('callouts become :::note and label spans become bold', () => {
  const md = '<div class="callout observed">\n\n<span class="label observed">Observed</span> text\n\n</div>\n';
  const { markdown } = convertBody(md, ctx());
  assert.match(markdown, /^:::note info$/m);
  assert.match(markdown, /^\*\*Observed\*\* text$/m);
  assert.match(markdown, /^:::$/m);
  assert.doesNotMatch(markdown, /<div|<span/);
});

test('appends the canonical footer', () => {
  const { markdown } = convertBody('hello\n', ctx());
  assert.ok(markdown.endsWith(`\n\n元記事: ${CANON}\n`));
});

test('fenced and inline code is left untouched (Review Focus 2)', () => {
  const md = ['```html', '<div class="callout x">', '![a](b.svg)', '[l](../x)', '```', 'inline `<div>` and `![x](y.svg)` and `[a](b)`'].join('\n');
  const { markdown, assetUrls } = convertBody(md, ctx());
  assert.ok(markdown.includes('<div class="callout x">\n![a](b.svg)\n[l](../x)'));
  assert.ok(markdown.includes('inline `<div>` and `![x](y.svg)` and `[a](b)`'));
  assert.deepEqual(assetUrls, []);
});

test('a callout may contain a code fence', () => {
  const md = '<div class="callout">\n\n```js\nconst a = "</div>";\n```\n\n</div>\n';
  const { markdown } = convertBody(md, ctx());
  assert.ok(markdown.includes('const a = "</div>";'));
  assert.match(markdown, /^:::$/m);
});

test('fails closed on HTML Qiita would mangle', () => {
  assert.throws(() => convertBody('<table><tr></tr></table>', ctx()), /unsupported HTML <table>/);
  assert.throws(() => convertBody('<!-- note -->', ctx()), /HTML comment/);
  assert.doesNotThrow(() => convertBody('line<br>break and <https://example.com>', ctx()));
});

test('fails on unbalanced callouts and unterminated fences', () => {
  assert.throws(() => convertBody('<div class="callout">\n', ctx()), ConversionError);
  assert.throws(() => convertBody('```js\ncode', ctx()), /unterminated/);
});

test('svg images become a text fallback with a link to the built asset', () => {
  const html = page(img('Diagram one', '/_astro/a.H1.svg'));
  const { markdown, assetUrls } = convertBody('![Diagram one](../images/a.svg)\n', ctx({ builtHtml: html }));
  assert.match(markdown, /^> \*\*図:\*\* Diagram one$/m);
  assert.match(markdown, /^> \[図を開く \(SVG\)\]\(https:\/\/example\.test\/_astro\/a\.H1\.svg\)$/m);
  assert.deepEqual(assetUrls, ['https://example.test/_astro/a.H1.svg']);
});

test('hotlink mode and non-svg images stay images', () => {
  const svg = page(img('D', '/_astro/a.H1.svg'));
  assert.match(convertBody('![D](./a.svg)\n', ctx({ builtHtml: svg, svgMode: 'hotlink' })).markdown, /^!\[D\]\(https:\/\/example\.test\/_astro\/a\.H1\.svg\)$/m);
  const png = page(img('P', '/_astro/p.H2.png'));
  assert.match(convertBody('![P](./p.png)\n', ctx({ builtHtml: png })).markdown, /^!\[P\]\(https:\/\/example\.test\/_astro\/p\.H2\.png\)$/m);
});

test('image count and alt must agree with the built page', () => {
  const html = page(img('One', '/_astro/a.H.svg'));
  assert.throws(() => convertBody('![One](./a.svg)\n![Two](./b.svg)\n', ctx({ builtHtml: html })), /no counterpart/);
  assert.throws(() => convertBody('no images\n', ctx({ builtHtml: html })), /1 image\(s\)/);
  assert.throws(() => convertBody('![Other](./a.svg)\n', ctx({ builtHtml: html })), /alt text differs/);
});

test("alt pairing tolerates the build's typography and entities (Review Focus 1)", () => {
  const html = page(img('pi –mode rpc &#34;quoted&#34; &amp; more', '/_astro/a.H.svg'));
  assert.doesNotThrow(() => convertBody('![pi --mode rpc "quoted" & more](./a.svg)\n', ctx({ builtHtml: html })));
});

test('extractImages ignores images outside the prose container', () => {
  const html = page(img('In prose', '/_astro/a.H.svg'));
  assert.deepEqual(extractImages(html), [{ src: '/_astro/a.H.svg', alt: 'In prose' }]);
});

test('altKey and decodeEntities', () => {
  assert.equal(altKey('pi --mode rpc!'), altKey('pi –mode rpc'));
  assert.equal(decodeEntities('a&amp;b &lt;c&gt; &#39;x&#39; &#x27;y&#x27;'), "a&b <c> 'x' 'y'");
});

test('relative links resolve against the canonical URL and must exist', () => {
  const seen = [];
  const pageExists = (p) => (seen.push(p), p !== '/blog/missing/');
  assert.match(convertBody('[a](/blog/other/)\n', ctx({ pageExists })).markdown, /\[a\]\(https:\/\/example\.test\/blog\/other\/\)/);
  assert.throws(() => convertBody('[a](/blog/missing/)\n', ctx({ pageExists })), /does not exist/);
});

test('anchors become blog URLs and must exist in the built page', () => {
  assert.match(convertBody('[s](#sec)\n', ctx()).markdown, new RegExp(`\\[s\\]\\(${CANON}#sec\\)`));
  assert.throws(() => convertBody('[s](#missing)\n', ctx()), /anchor #missing/);
});

test('absolute and mailto links are untouched', () => {
  const { markdown } = convertBody('[a](https://x.test/p) [m](mailto:a@b.c)\n', ctx({ pageExists: () => false }));
  assert.ok(markdown.includes('[a](https://x.test/p) [m](mailto:a@b.c)'));
});

test('warns about footnotes and images that share a line with text', () => {
  const html = page(img('D', '/_astro/a.H.svg'));
  const { warnings } = convertBody('text[^1] ![D](./a.svg)\n', ctx({ builtHtml: html }));
  assert.equal(warnings.length, 2);
});

test('inline diagrams count as images: their standalone file is the source, aria-label the alt', () => {
  const svg = '<figure><svg class="diagram dg1" role="img" aria-label="A &gt; B &quot;quoted&quot;" data-diagram-src="/diagrams/a.svg" viewBox="0 0 1 1"></svg></figure>';
  const html = page(`${img('First', '/_astro/p.H.png')}${svg}`);
  assert.deepEqual(extractImages(html), [
    { src: '/_astro/p.H.png', alt: 'First' },
    { src: '/diagrams/a.svg', alt: 'A > B "quoted"' },
  ]);
  const { markdown, assetUrls } = convertBody('![First](./p.png)\n![A > B "quoted"](./a.svg)\n', ctx({ builtHtml: html, svgMode: 'hotlink' }));
  assert.deepEqual(assetUrls, ['https://example.test/_astro/p.H.png', 'https://example.test/diagrams/a.svg']);
  assert.match(markdown, /^!\[A > B "quoted"\]\(https:\/\/example\.test\/diagrams\/a\.svg\)$/m);
});

test('other inline svgs are not images', () => {
  assert.deepEqual(extractImages(page('<svg viewBox="0 0 1 1"><path d="M0 0"/></svg>')), []);
});
