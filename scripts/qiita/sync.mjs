import { isDefinitiveFailure, QiitaNetworkError } from './client.mjs';
import { saveMap } from './map.mjs';

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

// Replaced in Task 9; until then a pending slug can never be re-created.
async function recoverPending(slug) {
  throw new RecoveryRequiredError(`${slug}: a previous create may have succeeded; no matching Qiita item found`);
}
