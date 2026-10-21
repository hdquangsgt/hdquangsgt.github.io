// Converts the blog's Markdown into Qiita Markdown. URLs come from the built site in dist/, never from
// string-replacing source paths (Astro hashes asset names). Fails closed on anything Qiita might mangle.
import { existsSync } from 'node:fs';
import path from 'node:path';

export class ConversionError extends Error {}

const ALLOWED_TAGS = ['br'];
const FENCE = /^ {0,3}(`{3,}|~{3,})/;
const IMAGE = /!\[((?:[^\]\\]|\\.)*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
const LINK = /(?<!!)\[((?:[^\]\\]|\\.)*)\]\(([^)\s]+)((?:\s+"[^"]*")?)\)/g;
const LABEL_SPAN = /<span class="label [a-z-]+">([^<]*)<\/span>/g;
const FOOTNOTE = /\[\^[^\]]+\]/;

export function decodeEntities(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, e) => {
    const k = e.toLowerCase();
    if (k === 'amp') return '&';
    if (k === 'lt') return '<';
    if (k === 'gt') return '>';
    if (k === 'quot') return '"';
    if (k === 'apos') return "'";
    return String.fromCodePoint(k[1] === 'x' ? parseInt(k.slice(2), 16) : parseInt(k.slice(1), 10));
  });
}

/** Alt text as compared between source and built page: the build rewrites `--` to an en dash and encodes entities. */
export function altKey(s) {
  return decodeEntities(s).replace(/[^\p{L}\p{N}]+/gu, '');
}

/** `<img>` elements inside the article body, in document order. */
export function extractImages(html) {
  const start = html.indexOf('<div class="prose"');
  if (start < 0) throw new ConversionError('built page has no .prose container');
  const end = html.indexOf('<footer class="article-footer"', start);
  const region = html.slice(start, end < 0 ? undefined : end);
  const images = [];
  for (const m of region.matchAll(/<img\b(?:[^>"']|"[^"]*"|'[^']*')*>/g)) {
    const attrs = {};
    for (const a of m[0].matchAll(/([a-zA-Z-]+)="([^"]*)"/g)) attrs[a[1]] = decodeEntities(a[2]);
    if (!attrs.src) throw new ConversionError(`built <img> without src: ${m[0].slice(0, 80)}`);
    images.push({ src: attrs.src, alt: attrs.alt ?? '' });
  }
  return images;
}

export function makePageExists(distDir) {
  return (pathname) => {
    const rel = decodeURIComponent(pathname).replace(/^\//, '');
    const full = path.join(distDir, rel);
    return existsSync(path.join(full, 'index.html')) || (!pathname.endsWith('/') && existsSync(full));
  };
}

function maskInlineCode(line) {
  const saved = [];
  const masked = line.replace(/(`+)(?!`)(.+?)(?<!`)\1(?!`)/g, (m) => {
    saved.push(m);
    return `\u0000${saved.length - 1}\u0000`;
  });
  return { masked, restore: (s) => s.replace(/\u0000(\d+)\u0000/g, (_, i) => saved[Number(i)]) };
}

function assertNoHtml(text, lineNo, allowedTags) {
  if (text.includes('<!--')) throw new ConversionError(`line ${lineNo}: HTML comment may be dropped or shown by Qiita`);
  for (const m of text.matchAll(/<\/?([a-zA-Z][a-zA-Z0-9-]*)(?=[\s>/])/g)) {
    if (!allowedTags.includes(m[1].toLowerCase())) {
      throw new ConversionError(`line ${lineNo}: unsupported HTML <${m[1]}> would be stripped or mangled by Qiita`);
    }
  }
}

function hasId(html, id) {
  return html.includes(`id="${id}"`);
}

export function convertBody(body, ctx) {
  const { canonicalUrl, siteUrl, builtHtml, pageExists, svgMode = 'link', allowedTags = ALLOWED_TAGS } = ctx;
  const builtImages = extractImages(builtHtml);
  const siteOrigin = new URL(siteUrl).origin;
  const assetUrls = [];
  const warnings = [];
  const out = [];
  let imageIndex = 0;
  let calloutDepth = 0;
  let fence = null;

  body.split('\n').forEach((raw, i) => {
    const lineNo = i + 1;
    const line = raw.replace(/\r$/, '');
    const f = FENCE.exec(line);
    if (fence) {
      out.push(line);
      if (f && f[1][0] === fence[0] && f[1].length >= fence.length && /^ {0,3}[`~]+\s*$/.test(line)) fence = null;
      return;
    }
    if (f) {
      fence = f[1];
      out.push(line);
      return;
    }
    if (/^<div class="callout[^"]*">\s*$/.test(line)) {
      calloutDepth++;
      out.push(':::note info');
      return;
    }
    if (calloutDepth > 0 && /^<\/div>\s*$/.test(line)) {
      calloutDepth--;
      out.push(':::');
      return;
    }

    const { masked, restore } = maskInlineCode(line);
    let text = masked.replace(LABEL_SPAN, '**$1**');

    text = text.replace(IMAGE, (match, alt, src, offset, whole) => {
      const n = imageIndex++;
      const built = builtImages[n];
      if (!built) throw new ConversionError(`line ${lineNo}: markdown image #${n + 1} (${src}) has no counterpart in the built page`);
      if (altKey(restore(alt)) !== altKey(built.alt)) {
        throw new ConversionError(`line ${lineNo}: image #${n + 1} alt text differs between the source and the built page`);
      }
      const url = new URL(built.src, siteUrl).href;
      assetUrls.push(url);
      if (whole.trim() !== match) warnings.push(`line ${lineNo}: image shares a line with other text`);
      const cleanAlt = restore(alt).replace(/\s+/g, ' ').trim();
      if (svgMode === 'link' && /\.svg(\?|#|$)/i.test(url)) {
        return `> **図:** ${cleanAlt}\n>\n> [図を開く (SVG)](${url})`;
      }
      return `![${alt}](${url})`;
    });

    text = text.replace(LINK, (match, label, href, title) => {
      if (/^[a-z][a-z0-9+.-]*:/i.test(href)) return match;
      const url = new URL(href, canonicalUrl);
      if (href.startsWith('#')) {
        let id;
        try {
          id = decodeURIComponent(href.slice(1));
        } catch {
          id = href.slice(1);
        }
        if (!hasId(builtHtml, id)) throw new ConversionError(`line ${lineNo}: anchor ${href} not found in the built page`);
        return `[${label}](${url.href})${title}`;
      }
      if (url.origin === siteOrigin && !pageExists(url.pathname)) {
        throw new ConversionError(`line ${lineNo}: link ${href} points to ${url.pathname}, which does not exist in the built site`);
      }
      return `[${label}](${url.href})${title}`;
    });

    assertNoHtml(text, lineNo, allowedTags);
    if (FOOTNOTE.test(text)) warnings.push(`line ${lineNo}: footnotes may not render on Qiita`);
    out.push(restore(text));
  });

  if (fence) throw new ConversionError('unterminated code fence');
  if (calloutDepth !== 0) throw new ConversionError('unbalanced callout <div>');
  if (imageIndex !== builtImages.length) {
    throw new ConversionError(`markdown has ${imageIndex} image(s) but the built page has ${builtImages.length} image(s)`);
  }
  const markdown = `${out.join('\n').replace(/\n+$/, '')}\n\n元記事: ${canonicalUrl}\n`;
  return { markdown, warnings, assetUrls };
}
