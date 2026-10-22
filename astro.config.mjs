// @ts-check
import { defineConfig, fontProviders } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { satteri } from '@astrojs/markdown-satteri';
import inlineSvg from './src/markdown/inline-svg.mjs';

// Root-level user site (hdquangsgt.github.io), so no `base` is needed.
export default defineConfig({
  site: 'https://hdquangsgt.github.io',
  trailingSlash: 'always',
  // English lives at the root; other locales under /vi/ and /ja/ (see src/i18n.ts).
  i18n: {
    locales: ['en', 'vi', 'ja'],
    defaultLocale: 'en',
    routing: { prefixDefaultLocale: false },
  },
  // Self-hosted at build time (no runtime requests to Google). Only used when a reader picks it in the reading
  // settings: Be Vietnam Pro (the "Sans-serif" option, designed for Vietnamese diacritics) and JetBrains Mono
  // (code, and the "Monospace" option). The default and the serif option use system fonts. Japanese text falls
  // back to the OS Japanese fonts (see global.css).
  fonts: [
    {
      provider: fontProviders.google(),
      name: 'Be Vietnam Pro',
      cssVariable: '--font-text',
      weights: [400, 500, 600, 700],
      styles: ['normal', 'italic'],
      subsets: ['latin', 'latin-ext', 'vietnamese'],
      fallbacks: ['system-ui', 'sans-serif'],
    },
    {
      provider: fontProviders.google(),
      name: 'JetBrains Mono',
      cssVariable: '--font-code',
      weights: [400, 600],
      styles: ['normal'],
      subsets: ['latin', 'latin-ext', 'vietnamese'],
      fallbacks: ['monospace'],
    },
  ],
  integrations: [
    sitemap({
      // `<slug>/article/` is the standard-layout view of a slide article; its canonical page is the presentation.
      filter: (page) => !/\/blog\/[^/]+\/article\/$/.test(page),
      i18n: { defaultLocale: 'en', locales: { en: 'en-US', vi: 'vi-VN', ja: 'ja-JP' } },
    }),
  ],
  markdown: {
    // Diagrams (![alt](./x.svg)) are inlined so they follow the reader's theme; see src/markdown/inline-svg.mjs.
    processor: satteri({ mdastPlugins: [inlineSvg()] }),
    shikiConfig: {
      themes: { light: 'github-light', dark: 'github-dark' },
      wrap: false,
    },
  },
});
