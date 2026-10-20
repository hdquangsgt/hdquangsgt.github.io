// @ts-check
import { defineConfig, fontProviders } from 'astro/config';
import sitemap from '@astrojs/sitemap';

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
  // Self-hosted at build time (no runtime requests to Google). Be Vietnam Pro (body) was designed
  // for Vietnamese diacritics; Newsreader (headings) has Vietnamese coverage too. Japanese text falls
  // back to the OS Japanese fonts (see global.css).
  fonts: [
    {
      provider: fontProviders.google(),
      name: 'Newsreader',
      cssVariable: '--font-heading',
      weights: [500, 600],
      styles: ['normal'],
      subsets: ['latin', 'latin-ext', 'vietnamese'],
      fallbacks: ['Georgia', 'serif'],
    },
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
      i18n: { defaultLocale: 'en', locales: { en: 'en-US', vi: 'vi-VN', ja: 'ja-JP' } },
    }),
  ],
  markdown: {
    shikiConfig: {
      themes: { light: 'github-light', dark: 'github-dark' },
      wrap: false,
    },
  },
});
