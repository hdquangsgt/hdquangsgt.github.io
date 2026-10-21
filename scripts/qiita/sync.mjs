import { isDefinitiveFailure, QiitaNetworkError } from './client.mjs';
import { saveMap } from './map.mjs';
import { assertAllowlisted } from './select.mjs';

export class RecoveryRequiredError extends Error {}

export function planSync(prepared, map) {
  return prepared.map((p) => {
    const entry = map.items[p.slug];
    let action;
    if (!entry) action = 'create';
    else if (entry.state === 'pending') action = 'recover';
    else if (entry.state === 'unpublishing') action = 'blocked';
    else action = entry.hash === p.hash ? 'skip' : 'update';
    return { slug: p.slug, action };
  });
}

function assertItem(res) {
  if (!res || typeof res.id !== 'string' || !res.id || typeof res.url !== 'string') {
    throw new QiitaNetworkError('Qiita response is missing item id/url; the item may still have been created');
  }
  return res;
}

async function create(item, { map, mapPath, client, now }) {
  // Write-ahead: persist intent before the POST so a crash can never lead to a blind second create.
  map.items[item.slug] = { state: 'pending', title: item.payload.title, hash: item.hash, startedAt: now().toISOString() };
  saveMap(mapPath, map);
  let created;
  try {
    created = assertItem(await client.createItem(item.payload));
  } catch (e) {
    if (isDefinitiveFailure(e)) {
      delete map.items[item.slug];
      saveMap(mapPath, map);
    }
    throw e;
  }
  map.items[item.slug] = { state: 'synced', itemId: created.id, url: created.url, title: item.payload.title, hash: item.hash };
  saveMap(mapPath, map);
  return created.url;
}

async function update(item, entry, { map, mapPath, client }) {
  const updated = assertItem(await client.updateItem(entry.itemId, item.payload));
  map.items[item.slug] = { ...entry, url: updated.url, title: item.payload.title, hash: item.hash };
  saveMap(mapPath, map);
  return updated.url;
}

export async function runSync({ prepared, map, mapPath, client, now = () => new Date(), log = () => {} }) {
  const ctx = { map, mapPath, client, now, log };
  const results = [];
  for (const item of prepared) {
    let entry = map.items[item.slug];
    if (entry?.state === 'unpublishing') {
      throw new Error(`${item.slug}: an --unpublish was interrupted; rerun --unpublish ${item.slug} or inspect Qiita`);
    }
    if (entry?.state === 'pending') entry = await recoverPending(item.slug, entry, ctx);
    if (!entry) {
      log(`${item.slug}: creating`);
      results.push({ slug: item.slug, action: 'create', url: await create(item, ctx) });
    } else if (entry.hash === item.hash) {
      results.push({ slug: item.slug, action: 'skip', url: entry.url });
    } else {
      log(`${item.slug}: updating ${entry.itemId}`);
      results.push({ slug: item.slug, action: 'update', url: await update(item, entry, ctx) });
    }
  }
  return results;
}

const CLOCK_SKEW_MS = 120_000;

async function recoverPending(slug, entry, { map, mapPath, client, log }) {
  const items = await client.listMyItems();
  const since = Date.parse(entry.startedAt) - CLOCK_SKEW_MS;
  const matches = items.filter((i) => i.title === entry.title && Date.parse(i.created_at) >= since);
  if (matches.length === 1) {
    const [m] = matches;
    log(`${slug}: adopting existing Qiita item ${m.id} from an interrupted create`);
    map.items[slug] = { state: 'synced', itemId: m.id, url: m.url, title: entry.title, hash: entry.hash };
    saveMap(mapPath, map);
    return map.items[slug];
  }
  if (matches.length === 0) {
    throw new RecoveryRequiredError(
      `${slug}: a previous create may have succeeded, but no matching Qiita item found. Check Qiita, then run ` +
        `--recover ${slug} --item-id <id>  (it exists)  or  --recover ${slug} --not-created  (it does not).`,
    );
  }
  throw new RecoveryRequiredError(
    `${slug}: several Qiita items could be the interrupted create: ${matches.map((m) => `${m.id} (${m.url})`).join(', ')}. ` +
      `Delete the extras on Qiita, then run --recover ${slug} --item-id <id>.`,
  );
}

export async function recoverManual({ slug, itemId, notCreated, allowlist, map, mapPath, client }) {
  assertAllowlisted(slug, allowlist);
  const entry = map.items[slug];
  if (entry?.state !== 'pending') throw new Error(`${slug} is not pending; nothing to recover`);
  if (Boolean(itemId) === Boolean(notCreated)) throw new Error('pass exactly one of --item-id or --not-created');
  if (notCreated) {
    delete map.items[slug];
    saveMap(mapPath, map);
    return;
  }
  const other = Object.entries(map.items).find(([s, e]) => s !== slug && e.itemId === itemId);
  if (other) throw new Error(`item ${itemId} is already mapped to "${other[0]}"`);
  const [item, me] = await Promise.all([client.getItem(itemId), client.getAuthenticatedUser()]);
  if (item.title !== entry.title) throw new Error(`item ${itemId} title "${item.title}" does not match "${entry.title}"`);
  if (item.user?.id !== me.id) throw new Error(`item ${itemId} owner does not match the token's user`);
  map.items[slug] = { state: 'synced', itemId: item.id, url: item.url, title: entry.title, hash: entry.hash };
  saveMap(mapPath, map);
}

/** A mapped slug whose post vanished, plus a new post with the same title, is almost certainly a rename. */
export function checkRenames({ map, eligible, allSlugs }) {
  for (const [slug, entry] of Object.entries(map.items)) {
    if (allSlugs.has(slug)) continue;
    const clash = eligible.find((p) => !map.items[p.slug] && p.payload.title === entry.title);
    if (clash) {
      throw new Error(
        `"${slug}" is in scripts/qiita-map.json but its file is gone, and new post "${clash.slug}" has the same title. ` +
          `This looks like a rename: edit the map and rename the key "${slug}" to "${clash.slug}" so the Qiita item is updated, not duplicated.`,
      );
    }
  }
}

/** Every image URL must already be live, otherwise Qiita would show broken images. */
export async function preflightAssets(urls, fetchImpl = globalThis.fetch) {
  const bad = [];
  for (const url of new Set(urls)) {
    try {
      const res = await fetchImpl(url, { method: 'HEAD', redirect: 'follow', signal: AbortSignal.timeout(15000) });
      if (res.status !== 200) bad.push(`${url} -> ${res.status}`);
    } catch (e) {
      bad.push(`${url} -> ${e.message}`);
    }
  }
  if (bad.length) throw new Error(`asset preflight failed (is the site deployed?):\n${bad.join('\n')}`);
}
