import { readFileSync } from 'node:fs';
import { QIITA_LANG } from './config.mjs';

export function loadAllowlist(file) {
  const list = JSON.parse(readFileSync(file, 'utf8'));
  if (!Array.isArray(list) || !list.every((s) => typeof s === 'string' && s)) {
    throw new Error(`${file} must be a JSON array of slugs`);
  }
  return list;
}

export function assertAllowlisted(slug, allowlist) {
  if (!allowlist.includes(slug)) throw new Error(`"${slug}" is not in scripts/qiita/allowlist.json`);
}

/** Unpublishing a post that is still flagged would just recreate it on the next sync. */
export function assertNotFlagged(posts, slug) {
  const post = posts.find((p) => p.lang === QIITA_LANG && p.slug === slug);
  if (post?.data.qiita?.publish === true) {
    throw new Error(`"${slug}" still has qiita.publish: true; set it to qiita.publish: false first`);
  }
}

export function selectPosts(posts, allowlist, now = new Date()) {
  const eligible = [];
  const skipped = [];
  const errors = [];
  for (const post of posts) {
    if (post.data.qiita?.publish !== true) continue;
    if (post.lang !== QIITA_LANG) {
      errors.push(`${post.id}: qiita.publish is only allowed on ${QIITA_LANG} posts`);
      continue;
    }
    if (!allowlist.includes(post.slug)) {
      errors.push(`${post.id}: slug "${post.slug}" is not in scripts/qiita/allowlist.json`);
      continue;
    }
    if (post.data.draft === true) {
      skipped.push({ slug: post.slug, reason: 'draft' });
      continue;
    }
    if (new Date(post.data.pubDate) > now) {
      skipped.push({ slug: post.slug, reason: 'scheduled' });
      continue;
    }
    eligible.push(post);
  }
  return { eligible, skipped, errors };
}

/** Slugs that still have a Qiita item in the map but are no longer flagged for publishing. */
export function findOrphans(posts, map) {
  const flagged = new Set(
    posts.filter((p) => p.lang === QIITA_LANG && p.data.qiita?.publish === true).map((p) => p.slug),
  );
  return Object.keys(map.items).filter((slug) => !flagged.has(slug));
}
