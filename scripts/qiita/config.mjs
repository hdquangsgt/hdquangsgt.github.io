import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const BLOG_DIR = path.join(REPO_ROOT, 'src/content/blog');
export const DIST_DIR = path.join(REPO_ROOT, 'dist');
export const MAP_PATH = path.join(REPO_ROOT, 'scripts/qiita-map.json');
export const ALLOWLIST_PATH = path.join(REPO_ROOT, 'scripts/qiita/allowlist.json');
export const PREVIEW_DIR = path.join(REPO_ROOT, '.qiita-preview');
/** Must equal `site` in astro.config.mjs (checked by config.test.mjs). */
export const SITE_URL = 'https://hdquangsgt.github.io';
export const QIITA_LANG = 'ja';
export const QIITA_API = 'https://qiita.com/api/v2';
