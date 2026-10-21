import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';

const PREFIXED_LOCALES = ['vi', 'ja'];

export function parseFrontmatter(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text);
  if (!m) throw new Error('missing frontmatter');
  return { data: parse(m[1]) ?? {}, body: text.slice(m[0].length) };
}

/** English posts live at <slug>.md; translations at <lang>/<slug>.md (same convention as src/utils/posts.ts). */
export function describePost(id, text, file) {
  const { data, body } = parseFrontmatter(text);
  const first = id.split('/')[0];
  const lang = id.includes('/') && PREFIXED_LOCALES.includes(first) ? first : 'en';
  const slug = lang === 'en' ? id : id.slice(id.indexOf('/') + 1);
  return { id, lang, slug, data, body, file };
}

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.name.endsWith('.md')) out.push(full);
  }
  return out;
}

export function loadPosts(blogDir) {
  return walk(blogDir)
    .sort()
    .map((file) => {
      const id = path.relative(blogDir, file).split(path.sep).join('/').replace(/\.md$/, '');
      return describePost(id, readFileSync(file, 'utf8'), file);
    });
}
