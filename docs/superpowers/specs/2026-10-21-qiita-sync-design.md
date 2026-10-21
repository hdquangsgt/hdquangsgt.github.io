# Qiita sync: design

Status: approved in conversation 2026-10-21, pending written-spec review.

## Goal

Publish selected Japanese blog posts to Qiita from this repository, with explicit per-post opt-in, no duplicate Qiita items, and no change to the blog's design, content structure or deploy workflow.

**Scope now:** only `src/content/blog/ja/pi-agent-freedom-vs-convenience.md` may be published. All other posts are forbidden, enforced in code (see Allowlist).

## Non-goals

- Syncing `en` or `vi` posts.
- Deleting Qiita items automatically (including when a flag is removed).
- Uploading images to Qiita (no API exists).
- Any change to Astro rendering, styles, routes or the deploy workflow.

## Verified vs unverified Qiita behavior

No Qiita token was available during design; nothing was tested against a live account.

| Fact | Status | Source |
|---|---|---|
| `POST /api/v2/items` requires `title`, `body`, `tags` (`[{name, versions}]`) | Verified | https://qiita.com/api/v2/docs |
| `PATCH /api/v2/items/:id` requires `title`, `body`; `tags`, `private` optional | Verified | API docs |
| `DELETE /api/v2/items/:id` exists, returns the item (accept 200 or 204) | Verified | API docs |
| Responses include `id`, `url`; rate limit 1000 req/h authenticated | Verified | API docs |
| No image upload endpoint | Verified (none documented) | API docs |
| Non-GET requests need `write_qiita` token | Verified | API docs |
| `private: true` creates a URL-only item (response `private: true`, URL `/<user>/private/<id>`); not searchable | Created and URL-visible: **verified** (probe 2026-10-21). Search exclusion: **unverified** | Live probe |
| `Authorization: Bearer <token>` header | **Verified** (probe; also used by Qiita CLI's client) | Live probe |
| Tag limits | 5 max, 1 min: Qiita CLI validator; probe got an unexplained 403 for 6 tags. Characters: **unverified**. Qiita also rewrites tag names (`test` came back as `テスト`) | Live probe, Qiita CLI source |
| SVG images render (hotlinked) | **Verified** by the owner in a logged-out browser (probe 2026-10-21) | Live probe |
| `<div>`, `<span>`, HTML comments survive sanitizing | **Unverified** | Live probe |
| `GET /authenticated_user/items` usable for crash recovery | **Verified** (it listed the limited-sharing probe item) | Live probe |

### Step 0: live probe

`scripts/qiita/probe.mjs` takes a fixture file (never a blog post). It creates one `private: true` item and checks rendering (SVG hotlink, `:::note`, mermaid, HTML), logged-out visibility and search visibility, PATCH, DELETE status, tag limits, the auth header and the item listing. Run by the user: `! QIITA_TOKEN=… node scripts/qiita/probe.mjs <fixture>`. Results are recorded in `docs/maintenance.md`; if a result contradicts this spec, the spec is revised before sync code is built on it.

## Frontmatter

New optional field in `src/content.config.ts` (ignored by rendering):

```yaml
qiita:
  publish: true          # absent or false: blog-only
  visibility: limited    # limited (default) | public
  tags: [AI, Claude]     # optional; falls back to post tags; max 5
```

`visibility` is declarative and part of the payload hash, so a run can never flip a public item back to limited or the reverse unintentionally. Nothing is public until `visibility: public` is committed.

## Eligibility

A pure function `selectPosts(posts, allowlist, now)`. A post is published only if **all** hold:

1. It is under `ja/`.
2. Its slug is in `scripts/qiita/allowlist.json` (initially only `pi-agent-freedom-vs-convenience`).
3. `qiita.publish === true`.
4. Not `draft`, and `pubDate <= now`.

Errors (run fails, naming slug and reason): `qiita.publish: true` on a non-`ja` post, or on a slug not in the allowlist. `publish` false or absent: skipped, never deleted. A mapped post that is no longer flagged is reported as an orphan with a pointer to `--unpublish`. `--unpublish` and `--recover` are also restricted to allowlisted slugs. Adding a post requires two deliberate edits: the allowlist and its frontmatter.

## Conversion (Markdown to Qiita)

Runs after `npm run build`; the built `dist/` is the source of truth for URLs.

- **Images.** Read `dist/ja/blog/<slug>/index.html`, take `<img>` elements in document order, and pair them with Markdown images in source order. Counts must match, and alt text must match after entity-decoding and dropping punctuation (the build rewrites `--` to an en dash); otherwise fail. Each resolves to `site + src` from the built HTML (hashed `/_astro/…` names). Preflight: `HEAD` each resolved URL on the live site must return 200.
- **SVG fallback (default).** Replace each image with `> **図:** <alt>` and `[図を開く (SVG)](absolute-url)`. If the probe shows hotlinked SVG renders, option `svg: hotlink` emits normal `![alt](url)`. PNG generation is a contingency (changes blog assets) and is not planned.
- **Links.** Relative and root links resolve against the post's canonical URL; the target must exist in `dist/`. `#anchor` links become `blog-url#id`, with the id verified in the built HTML (Qiita generates its own heading anchors).
- **Callouts.** `<div class="callout …">` (variants: documented, observed, opinion, proposal, plain) becomes `:::note info`; `<span class="label …">X</span>` becomes bold `**X**`, preserving meaning.
- **Fail closed.** Any HTML tag outside a small allowlist after conversion stops the run. Constructs Qiita may not support (e.g. footnotes) are reported, not dropped silently.
- **Footer.** Append `元記事: <canonical URL>`.
- Code fences, tables and headings pass through unchanged.

Facts for the Japanese Pi article: 12 images (13 SVG files exist; one is unused in `ja`), 50 callout divs.

## Payload, hash, map

- Payload: `{title, body, tags, private}`; body normalized (LF, trailing whitespace trimmed, final newline); tags normalized (trim, dedupe, max 5, at least 1).
- Hash: `sha256("v1:" + canonical JSON with sorted keys)`. The `v1` converter version forces intentional re-sync when conversion changes. Compared against the stored hash, not Qiita's copy.
- `scripts/qiita-map.json`: keyed by slug, `{state, itemId, url, title, hash, startedAt}`, states `pending | synced | unpublishing`. Writes are temp-file plus rename.

## Create, update, partial failure

- **Update:** slug has `synced` entry and hash differs: `PATCH`. Hash equal: skip. `PATCH` is idempotent and may be retried.
- **Create:** write `pending` (hash, `startedAt`) to the map **before** `POST`. On success, set `synced` with id and url.
- **Never retry a possibly-successful create.** If `POST` hit a network error, timed out, returned 5xx, or returned a body without an `id`, the slug stays `pending` and further creation is blocked. A 4xx response means Qiita definitively rejected the request, so the `pending` entry is removed instead (a bad token or invalid payload needs no manual recovery).
- **Recovery on next run** for a `pending` slug: list the user's items and find an exact title match created after `startedAt`. One match: adopt its id. Zero: stop and print `--recover <slug> --item-id <id>` and `--recover <slug> --not-created`. Several: stop. (Depends on the unverified listing behavior; manual flags are the fallback.)
- **Slug rename guard:** a mapped slug whose file is gone, plus a new post with the same title, fails with instructions to re-key the map.

## Unpublish

`--unpublish <slug>` only: allowlisted slug; load map entry; `GET` the item; require id, URL and title to match the map and the owner to match the token's user; always require `--confirm <slug>` equal to the slug (workflow input `confirm_slug`), and refuse while the post still has `qiita.publish: true` (otherwise the next sync would recreate it). `DELETE`; 404 means already gone; 200 or 204 removes the map entry. Any mismatch aborts with nothing deleted.

## Credentials

`QIITA_TOKEN` only from the environment (GitHub Environment secret in CI, untracked `.env` locally). Never logged; the client redacts it from errors. Scopes: `read_qiita`, `write_qiita`. Dry-run never needs or receives it.

## Dry-run

All HTTP goes through one `request()` function. In dry-run it throws on any non-GET and makes no network call. Writes converted previews to `.qiita-preview/` (gitignored) and prints the plan: create, update, skip, orphan. Default for local runs and for the workflow.

## GitHub Actions: `.github/workflows/qiita-sync.yml`

- Triggers (amended 2026-10-21, after the live probe): `workflow_run` of *Deploy to GitHub Pages* (completed, successful, `push` to `main` only, checked out at the deployed commit so image URLs are live), plus `workflow_dispatch` with inputs `dry_run` (default true), `unpublish_slug`, `confirm_slug`. Dry-run and the wrong-branch guard only react to manual dispatch. Pushes with `GITHUB_TOKEN` do not trigger the deploy workflow, so the map commit cannot loop. Automatic runs still publish only allowlisted, flagged posts, and the first create stays `visibility: limited` until the post is changed to `public`.
- Image URLs default to hotlinking (`--svg hotlink`) because the probe showed Qiita renders them; `--svg link` keeps the caption-and-link fallback.
- `concurrency: { group: qiita-sync, cancel-in-progress: false }`.
- Job `sync`: `permissions: contents: read`; has `QIITA_TOKEN` (Environment `qiita`, real runs only); checkout, Node 24, `npm ci`, `npm run build`, sync; uploads the map as an artifact and exposes `map_changed`.
- Job `commit-map`: `permissions: contents: write`; **no secret**; `if: always()` and `map_changed`; commits only `scripts/qiita-map.json` after `git pull --rebase`. It commits the whole map, including `pending` entries: the runner is ephemeral, so an uncommitted `pending` entry is lost and the next run would create a duplicate. This deliberately deviates from "commit only after full success". (If a runner is killed before the artifact is saved, check Qiita for a duplicate and use `--recover`.)
- Pushes with `GITHUB_TOKEN` do not trigger the deploy workflow. If branch protection blocks the push, the job fails visibly and the artifact holds the map.
- Action versions follow `deploy.yml` (`checkout@v7`).

## Code layout

```
scripts/qiita/allowlist.json
scripts/qiita/select.mjs      eligibility
scripts/qiita/convert.mjs     Markdown conversion, URL resolution
scripts/qiita/payload.mjs     normalization, hash
scripts/qiita/client.mjs      HTTP, auth, dry-run guard
scripts/qiita/sync.mjs        plan and execute, map, recovery, unpublish
scripts/qiita/cli.mjs         flags
scripts/qiita/probe.mjs       step 0
scripts/qiita/*.test.mjs
scripts/qiita-map.json
```

`package.json`: scripts `qiita:sync` and `test:qiita` (`node --test scripts/qiita/`); devDependency `yaml` 2.9.1 declared explicitly (already in `package-lock.json` via Astro). `.gitignore`: `.qiita-preview/`. No other dependencies.

## Tests (`node --test`, fake `fetch`)

- Eligibility: `ja` only, allowlist, flag, draft, future date, orphan reporting, flagged non-allowlisted post errors, allowlist alone publishes nothing.
- Conversion: image pairing and mismatch failure, SVG fallback, links and anchors, callouts, fail-closed HTML; golden test on the real Japanese Pi article with a fake `dist` (12 fallbacks, no `![](….svg)`, 50 callouts converted, no `<div`/`<span` left).
- Hash: stability, change detection for each payload field, `v1` prefix.
- Duplicate prevention: `pending` blocks re-create; recovery with one, zero and several matches.
- API failures: 401, 429, 5xx, malformed body.
- Dry-run: no mutating call, no token needed.
- Unpublish: validation mismatches, allowlist restriction, 404 handling, confirmation.

## Documentation

`README.md` and `docs/maintenance.md`: frontmatter reference, local commands (`npm run qiita:sync -- --dry-run`, `--unpublish`, `--recover`), workflow usage, recovery procedures, probe results and the remaining unverified facts.

## Rollout

1. Run the live probe with the fixture; record results; revise this spec if needed.
2. Build converter and tests, then client and sync logic.
3. Dry-run on the Japanese Pi article and review `.qiita-preview/`.
4. Real run with `visibility: limited`; verify visibility, search exclusion and rendered images logged out.
5. Only then consider `visibility: public`.

No existing post is touched unless the user sets `qiita.publish: true` and adds its slug to the allowlist.
