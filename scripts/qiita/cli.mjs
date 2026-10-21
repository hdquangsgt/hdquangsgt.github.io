// Usage (see docs/maintenance.md):
//   npm run qiita:sync                      dry-run: converts, writes .qiita-preview/, prints the plan, no network
//   npm run qiita:sync -- --apply           create/update on Qiita (needs QIITA_TOKEN and a fresh `npm run build`)
//   npm run qiita:sync -- --apply --unpublish <slug> --confirm <slug>
//   npm run qiita:sync -- --apply --recover <slug> (--item-id <id> | --not-created)
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { createClient, redact } from './client.mjs';
import { ALLOWLIST_PATH, BLOG_DIR, DIST_DIR, MAP_PATH, PREVIEW_DIR, QIITA_LANG, SITE_URL } from './config.mjs';
import { convertBody, makePageExists } from './convert.mjs';
import { loadMap, serializeMap } from './map.mjs';
import { buildPayload, hashPayload } from './payload.mjs';
import { loadPosts } from './posts.mjs';
import { assertAllowlisted, assertNotFlagged, findOrphans, loadAllowlist, selectPosts } from './select.mjs';
import { checkRenames, planSync, preflightAssets, recoverManual, runSync, unpublish } from './sync.mjs';

function prepare(post, deps, svgMode) {
  const builtFile = path.join(deps.distDir, post.lang, 'blog', post.slug, 'index.html');
  if (!existsSync(builtFile)) throw new Error(`${post.slug}: ${builtFile} not found. Run \`npm run build\` first.`);
  const converted = convertBody(post.body, {
    canonicalUrl: `${deps.siteUrl}/${post.lang}/blog/${post.slug}/`,
    siteUrl: deps.siteUrl,
    builtHtml: readFileSync(builtFile, 'utf8'),
    pageExists: makePageExists(deps.distDir),
    svgMode,
  });
  const q = post.data.qiita;
  const payload = buildPayload({
    title: post.data.title,
    body: converted.markdown,
    tags: q.tags ?? post.data.tags ?? [],
    visibility: q.visibility ?? 'limited',
  });
  return { slug: post.slug, title: payload.title, payload, hash: hashPayload(payload), assetUrls: converted.assetUrls, warnings: converted.warnings };
}

function writePreview(dir, item) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, `${item.slug}.md`), item.payload.body);
  const { body, ...meta } = item.payload;
  writeFileSync(path.join(dir, `${item.slug}.json`), `${JSON.stringify({ ...meta, hash: item.hash }, null, 2)}\n`);
}

export async function main(argv, env, overrides = {}) {
  const deps = {
    blogDir: BLOG_DIR,
    distDir: DIST_DIR,
    mapPath: MAP_PATH,
    allowlistPath: ALLOWLIST_PATH,
    previewDir: PREVIEW_DIR,
    siteUrl: SITE_URL,
    fetchImpl: globalThis.fetch,
    log: console.log,
    err: console.error,
    ...overrides,
  };
  const token = env.QIITA_TOKEN;
  let before;
  try {
    const { values } = parseArgs({
      args: argv,
      options: {
        apply: { type: 'boolean', default: false },
        unpublish: { type: 'string' },
        confirm: { type: 'string' },
        recover: { type: 'string' },
        'item-id': { type: 'string' },
        'not-created': { type: 'boolean', default: false },
        svg: { type: 'string', default: 'link' },
      },
    });
    if (!['link', 'hotlink'].includes(values.svg)) throw new Error('--svg must be "link" or "hotlink"');

    const allowlist = loadAllowlist(deps.allowlistPath);
    const posts = loadPosts(deps.blogDir);
    const map = loadMap(deps.mapPath);
    before = serializeMap(map);
    const client = createClient({ token, fetchImpl: deps.fetchImpl, dryRun: !values.apply });

    if (values.unpublish) {
      assertAllowlisted(values.unpublish, allowlist);
      assertNotFlagged(posts, values.unpublish);
      if (!values.apply) {
        deps.log(`dry-run: would delete the Qiita item for "${values.unpublish}" (rerun with --apply)`);
        return 0;
      }
      const r = await unpublish({ slug: values.unpublish, confirm: values.confirm, allowlist, map, mapPath: deps.mapPath, client });
      deps.log(`${values.unpublish}: ${r.status}`);
      return 0;
    }

    if (values.recover) {
      if (!values.apply) {
        deps.log(`dry-run: would recover "${values.recover}" (rerun with --apply)`);
        return 0;
      }
      await recoverManual({
        slug: values.recover,
        itemId: values['item-id'],
        notCreated: values['not-created'],
        allowlist,
        map,
        mapPath: deps.mapPath,
        client,
      });
      deps.log(`${values.recover}: recovered`);
      return 0;
    }

    const { eligible, skipped, errors } = selectPosts(posts, allowlist);
    if (errors.length) {
      errors.forEach((e) => deps.err(`error: ${e}`));
      return 1;
    }
    skipped.forEach((s) => deps.log(`skip: ${s.slug} (${s.reason})`));
    findOrphans(posts, map).forEach((slug) =>
      deps.log(`warn: "${slug}" is in the map (still on Qiita) but is not flagged; use --unpublish ${slug} to remove it`),
    );

    const prepared = eligible.map((post) => prepare(post, deps, values.svg));
    for (const item of prepared) {
      writePreview(deps.previewDir, item);
      item.warnings.forEach((w) => deps.log(`warn: ${item.slug}: ${w}`));
    }
    for (const step of planSync(prepared, map)) deps.log(`${step.slug}: ${step.action}`);
    if (!values.apply) {
      deps.log(`dry-run: previews written to ${deps.previewDir}; nothing was sent`);
      return 0;
    }

    if (!token) throw new Error('QIITA_TOKEN is not set');
    checkRenames({ map, eligible: prepared, allSlugs: new Set(posts.filter((p) => p.lang === QIITA_LANG).map((p) => p.slug)) });
    await preflightAssets(prepared.flatMap((p) => p.assetUrls), deps.fetchImpl);
    const results = await runSync({ prepared, map, mapPath: deps.mapPath, client, log: deps.log });
    results.forEach((r) => deps.log(`${r.slug}: ${r.action} ${r.url ?? ''}`.trim()));
    return 0;
  } catch (e) {
    deps.err(`error: ${redact(e.message, token)}`);
    return 1;
  } finally {
    if (env.GITHUB_OUTPUT && before !== undefined) {
      const after = serializeMap(loadMap(deps.mapPath));
      appendFileSync(env.GITHUB_OUTPUT, `map_changed=${after !== before}\n`);
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(await main(process.argv.slice(2), process.env));
}
