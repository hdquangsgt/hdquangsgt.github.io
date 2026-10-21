// Inlines local SVG diagrams into the page at build time, so they can follow the reader's theme.
//
// An SVG loaded through <img> cannot see the page's `data-theme` attribute or CSS variables, so it can only
// follow the operating system. Inlined, it can. The source files stay standalone, valid SVGs (they still use
// `@media (prefers-color-scheme: dark)`, which is what <img> embedding, e.g. a Qiita hotlink, relies on);
// this plugin rewrites each one for the page:
//   - every rule is scoped to the diagram (`.dg1 .box`), because several diagrams define the same class names
//     with different values;
//   - the `prefers-color-scheme: dark` block becomes `:root[data-theme="dark"] .dg1 ...`;
//   - ids (arrow markers) get a per-diagram prefix, because ids are global to the page;
//   - the diagram is exposed as one image (`role="img"`, `aria-label` = the Markdown alt text).
// Colors that should follow the site use `var(--color-*, fallback)` in the source (see the `.bg`, `.t`, `.m`
// rules); the fallback is what a standalone <img> shows.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const escapeAttr = (text) =>
  text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const DARK_MEDIA = /@media\s*\(\s*prefers-color-scheme\s*:\s*dark\s*\)\s*\{/;

/** Prefixes every selector of a flat list of rules (`a, b { ... }`). */
function scopeRules(css, prefix) {
  return css.replace(/([^{}]+)\{([^{}]*)\}/g, (_, selectors, body) => {
    const scoped = selectors
      .split(',')
      .map((s) => `${prefix} ${s.trim()}`)
      .join(', ');
    return `${scoped} {${body}}`;
  });
}

/**
 * Rewrites one standalone SVG for inline use.
 * @param {string} source SVG file contents
 * @param {{ id: string, label: string, src: string }} options `id` must be unique on the page
 */
export function inlineSvg(source, { id, label, src }) {
  const styleMatch = source.match(/<style>([\s\S]*?)<\/style>/);
  let styles = '';
  if (styleMatch) {
    const css = styleMatch[1];
    const media = css.match(DARK_MEDIA);
    const light = media ? css.slice(0, media.index) : css;
    let dark = '';
    if (media) {
      const rest = css.slice(media.index + media[0].length);
      dark = rest.slice(0, rest.lastIndexOf('}')); // drop the @media block's closing brace
      if (/@media|@import|@font-face/.test(rest)) throw new Error(`${src}: only one dark @media block is supported`);
    }
    if (/@media|@import|@font-face/.test(light)) throw new Error(`${src}: unsupported at-rule in <style>`);
    styles = `<style>${scopeRules(light, `.${id}`)}${scopeRules(dark, `:root[data-theme="dark"] .${id}`)}</style>`;
  }

  let svg = source.replace(/<style>[\s\S]*?<\/style>/, styles).replace(/<\?xml[^>]*\?>\s*/, '');

  // ids are page-global: prefix them and their references.
  for (const [, name] of svg.matchAll(/\bid="([^"]+)"/g)) {
    svg = svg.replaceAll(`id="${name}"`, `id="${id}-${name}"`).replaceAll(`url(#${name})`, `url(#${id}-${name})`);
  }

  return svg.replace(/<svg\b/, `<svg class="diagram ${id}" role="img" aria-label="${escapeAttr(label)}" data-diagram-src="${escapeAttr(src)}"`);
}

/**
 * Sätteri (mdast) plugin: a paragraph holding only `![alt](./some.svg "caption")` becomes a figure with the SVG inline.
 * Other images are left to Astro's image pipeline. `diagramUrl` maps an SVG's file name to the public URL where the
 * original file is served (the Qiita sync hotlinks it).
 */
export default function inlineSvgPlugin({ diagramUrl = (name) => `/diagrams/${name}` } = {}) {
  return (factoryContext) => {
    if (!factoryContext.fileURL) return null;
    const documentPath = fileURLToPath(factoryContext.fileURL);
    let count = 0;
    return {
      name: 'inline-svg-diagrams',
      paragraph(node, ctx) {
        const [image, ...rest] = node.children;
        if (!image || rest.length > 0 || image.type !== 'image' || !/\.svg$/i.test(image.url)) return;
        if (/^[a-z][a-z0-9+.-]*:|^\//i.test(image.url)) return; // remote or site-absolute: leave to Astro
        const file = new URL(image.url, factoryContext.fileURL);
        const name = file.pathname.split('/').pop();
        let source;
        try {
          source = readFileSync(file, 'utf8');
        } catch {
          throw new Error(`${documentPath}: cannot read diagram ${image.url}`);
        }
        const svg = inlineSvg(source, { id: `dg${++count}`, label: image.alt ?? '', src: diagramUrl(name) });
        const caption = image.title
          ? `<figcaption>${image.title.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</figcaption>`
          : '';
        const html = `<figure class="figure diagram-figure"><div class="figure-scroll figure-scroll-wide" tabindex="0">${svg}</div>${caption}</figure>`;
        ctx.replaceNode(node, { type: 'html', value: html });
      },
    };
  };
}
