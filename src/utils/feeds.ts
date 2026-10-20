import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { SITE } from '../consts';
import { LOCALE_META, localizePath, useTranslations, type Lang } from '../i18n';
import { getPublishedPosts, plainText, postUrl } from './posts';

export async function rssFeed(context: APIContext, lang: Lang) {
  const posts = await getPublishedPosts(lang);
  const t = useTranslations(lang);
  return rss({
    title: SITE.title,
    description: t.siteDescription,
    site: new URL(localizePath(lang, '/'), context.site ?? 'https://hdquangsgt.github.io').href,
    trailingSlash: true,
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.pubDate,
      link: postUrl(post),
      categories: [t.categories[post.data.category], ...post.data.tags],
    })),
    customData: `<language>${LOCALE_META[lang].htmlLang}</language>`,
  });
}

/** Static search index used by the archive page. Built at deploy time, so it only contains published articles. */
export async function searchIndex(lang: Lang) {
  const posts = await getPublishedPosts(lang);
  const t = useTranslations(lang);
  const entries = posts.map((post) => ({
    id: post.id,
    title: post.data.title,
    description: post.data.description,
    category: t.categories[post.data.category],
    tags: post.data.tags,
    text: plainText(post.body),
  }));
  return new Response(JSON.stringify(entries), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}
