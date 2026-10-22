// getStaticPaths builders shared by the English routes (src/pages/) and the
// prefixed-locale routes (src/pages/[lang]/), so both generate identical pages.
import { LOCALES, PREFIXED_LOCALES, type Lang } from '../i18n';
import {
  categoriesWithCounts,
  categoryUrl,
  getAllPublishedPosts,
  postLang,
  postSlug,
  postTranslations,
  slugify,
  tagsWithCounts,
  tagUrl,
  type Post,
} from './posts';

/** Adds the `lang` param for routes under src/pages/[lang]/. */
async function forEachPrefixedLocale<T extends { params: object }>(build: (lang: Lang) => Promise<T[]>) {
  const perLocale = await Promise.all(
    PREFIXED_LOCALES.map(async (lang) =>
      (await build(lang)).map((path) => ({ ...path, params: { ...path.params, lang } })),
    ),
  );
  return perLocale.flat();
}

export function localeParams() {
  return PREFIXED_LOCALES.map((lang) => ({ params: { lang } }));
}

async function postsByLang() {
  const all = await getAllPublishedPosts();
  const byLang = (lang: Lang) => all.filter((p) => postLang(p) === lang);
  return { all, byLang };
}

export async function articlePaths(lang: Lang) {
  const { all, byLang } = await postsByLang();
  const posts = byLang(lang);
  return posts.flatMap((post, i) => {
    // Posts are sorted newest first, so the next index is the older article.
    const props = { post, newer: posts[i - 1], older: posts[i + 1], posts, alternates: postTranslations(post, all) };
    const paths: { params: { slug: string }; props: typeof props & { standard?: boolean } }[] = [{ params: { slug: postSlug(post) }, props }];
    // A slide article (`slides: true`) is a presentation at its own URL; `<slug>/article/` is the same content in
    // the standard blog layout.
    if (post.data.slides) paths.push({ params: { slug: `${postSlug(post)}/article` }, props: { ...props, standard: true } });
    return paths;
  });
}

export async function categoryPaths(lang: Lang) {
  const { byLang } = await postsByLang();
  const posts = byLang(lang);
  return categoriesWithCounts(posts).map(({ name }) => ({
    params: { category: slugify(name) },
    props: { name, posts, alternates: alternatesWhere((l) => byLang(l).some((p) => p.data.category === name), (l) => categoryUrl(name, l)) },
  }));
}

export async function tagPaths(lang: Lang) {
  const { byLang } = await postsByLang();
  const posts = byLang(lang);
  return tagsWithCounts(posts).map(({ name }) => ({
    params: { tag: slugify(name) },
    props: { name, posts, alternates: alternatesWhere((l) => byLang(l).some((p) => p.data.tags.includes(name)), (l) => tagUrl(name, l)) },
  }));
}

function alternatesWhere(exists: (lang: Lang) => boolean, url: (lang: Lang) => string) {
  return Object.fromEntries(LOCALES.filter(exists).map((l) => [l, url(l)])) as Partial<Record<Lang, string>>;
}

export const prefixed = {
  articlePaths: () => forEachPrefixedLocale(articlePaths),
  categoryPaths: () => forEachPrefixedLocale(categoryPaths),
  tagPaths: () => forEachPrefixedLocale(tagPaths),
};

export type TaxonomyProps = { name: string; posts: Post[]; alternates: Partial<Record<Lang, string>> };
