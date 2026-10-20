import { getCollection, type CollectionEntry } from 'astro:content';
import { CATEGORIES, type Category } from '../consts';
import { DEFAULT_LANG, isLang, localizePath, LOCALES, type Lang } from '../i18n';

export type Post = CollectionEntry<'blog'>;

/**
 * English articles live at src/content/blog/<slug>.md; translations live at
 * src/content/blog/<lang>/<slug>.md. Files with the same slug are translations of each other.
 */
export function postLang(post: Post): Lang {
  const first = post.id.split('/')[0];
  return post.id.includes('/') && isLang(first) ? first : DEFAULT_LANG;
}

/** The article's slug without its locale folder. */
export function postSlug(post: Post): string {
  return postLang(post) === DEFAULT_LANG ? post.id : post.id.slice(post.id.indexOf('/') + 1);
}

/** True when a post should not be public yet (draft or scheduled for the future). */
export function isUnpublished(post: Post, now = new Date()): boolean {
  return post.data.draft || post.data.pubDate > now;
}

/**
 * Visible posts in every language, newest first.
 * Production builds exclude drafts and future-dated posts; `astro dev` shows them for previewing.
 */
export async function getAllPublishedPosts(): Promise<Post[]> {
  const posts = await getCollection('blog', (post) => import.meta.env.DEV || !isUnpublished(post));
  return posts.sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
}

/** Visible posts in one language, newest first. */
export async function getPublishedPosts(lang: Lang = DEFAULT_LANG): Promise<Post[]> {
  return (await getAllPublishedPosts()).filter((post) => postLang(post) === lang);
}

export function postUrl(post: Post): string {
  return localizePath(postLang(post), `/blog/${postSlug(post)}/`);
}

/** URLs of every visible language version of a post, including itself, in LOCALES order. */
export function postTranslations(post: Post, all: Post[]): Partial<Record<Lang, string>> {
  const slug = postSlug(post);
  const urls: Partial<Record<Lang, string>> = {};
  for (const lang of LOCALES) {
    const match = all.find((p) => postLang(p) === lang && postSlug(p) === slug);
    if (match) urls[lang] = postUrl(match);
  }
  return urls;
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function categoryUrl(category: string, lang: Lang = DEFAULT_LANG): string {
  return localizePath(lang, `/blog/category/${slugify(category)}/`);
}

export function tagUrl(tag: string, lang: Lang = DEFAULT_LANG): string {
  return localizePath(lang, `/blog/tags/${slugify(tag)}/`);
}

/**
 * Estimated reading time in minutes, from the raw Markdown body.
 * Japanese has no spaces between words, so it is measured in characters instead.
 */
export function readingTime(body: string | undefined, lang: Lang = DEFAULT_LANG): number {
  const text = (body ?? '').trim();
  if (lang === 'ja') return Math.max(1, Math.round(text.replace(/\s+/g, '').length / 500));
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 220));
}

/** Categories that have at least one post, in the order defined in consts.ts. */
export function categoriesWithCounts(posts: Post[]): { name: Category; count: number }[] {
  return CATEGORIES.map((name) => ({
    name,
    count: posts.filter((p) => p.data.category === name).length,
  })).filter((c) => c.count > 0);
}

/** Tags sorted by frequency, then alphabetically. */
export function tagsWithCounts(posts: Post[]): { name: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const post of posts) {
    for (const tag of post.data.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/** The newest post marked `featured: true`: the article to point new readers to. No fallback, so nothing is promoted by accident. */
export function pickStartHere(posts: Post[]): Post | undefined {
  return posts.find((p) => p.data.featured);
}

/** Up to `limit` other posts ranked by shared tags, then same category. */
export function relatedPosts(post: Post, posts: Post[], limit = 3): Post[] {
  return posts
    .filter((p) => p.id !== post.id)
    .map((p) => ({
      post: p,
      score:
        p.data.tags.filter((t) => post.data.tags.includes(t)).length * 2 +
        (p.data.category === post.data.category ? 1 : 0),
    }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || b.post.data.pubDate.valueOf() - a.post.data.pubDate.valueOf())
    .slice(0, limit)
    .map((r) => r.post);
}

/** Rough Markdown-to-text conversion for the search index. */
export function plainText(markdown: string | undefined): string {
  return (markdown ?? '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_`|~-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
