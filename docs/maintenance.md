# Design maintenance guidelines

## Where decisions live

| Decision | File | Notes |
| --- | --- | --- |
| Colors, type scale, spacing, widths, radius | `src/styles/global.css` (`:root` block, top of file) | Light tokens, then a `:root[data-theme='dark']` override |
| Width primitives, derived widths and per-page overrides | `src/styles/global.css` (`body[data-width=…]`) and `src/layouts/BaseLayout.astro` (`width` prop) | `reading` default, `article` for articles |
| All component and prose styles | `src/styles/global.css` | One file, ordered: tokens → base → layout → header/footer → page pieces → home and lists → chips and search → article → prose → code → callouts → responsive |
| Fonts | `astro.config.mjs` (`fonts`) and `src/components/BaseHead.astro` (`<Font>` and preloads) | Japanese fallbacks in `global.css` (`:root:lang(ja)`) |
| Code highlighting themes | `astro.config.mjs` (`markdown.shikiConfig`) | Block background overridden in `global.css` |
| Site name, author, nav links, categories, home list size | `src/consts.ts` | `SITE`, `NAV_LINKS`, `CATEGORIES`, `RECENT_POSTS_LIMIT` |
| UI strings and locales | `src/i18n.ts` | Add a string to every language |
| Page markup | `src/views/*.astro` (composition), `src/components/*.astro` (parts), `src/pages/**` (routes only) | Views are shared by all languages |
| Frontmatter fields (title, description, category, tags, featured, draft, cover image) | `src/content.config.ts` | Schema errors fail the build |
| Reading time, related posts, URLs, "start here" selection | `src/utils/posts.ts` | |
| SEO and social tags, structured data | `src/components/BaseHead.astro` | Canonical, `hreflang`, Open Graph, JSON-LD |
| RSS and search index | `src/utils/feeds.ts` | |
| Qiita sync (opt-in, allowlist, conversion, API client, map) | `scripts/qiita/`, `scripts/qiita-map.json`, `.github/workflows/qiita-sync.yml` | Separate from the Astro build; spec in `docs/superpowers/specs/2026-10-21-qiita-sync-design.md` |
| Background specs | `tasks/guide_create_blog.md` (original spec), `tasks/layout/design.md` (design review) | Historical input, not authoritative for current values |

## Principles for changes

1. **Prefer the system you have.** Look for an existing token, class or component first. New visual treatments should be rare and justified by content, not taste.
2. **Change tokens, not instances.** To change a color or width site-wide, edit the token. If two components need a different value, that is a new token or modifier with a reason, not a local override.
3. **Change widths at the primitives.** Edit `--measure`, `--gutter`, `--toc`, `--toc-gap` or the article `--page`; `--page` is derived and stays consistent. After changing any of them, update the literal `65rem` breakpoint in the three places listed in [layout-and-pages.md](layout-and-pages.md#article-grid).
4. **Keep it quiet.** No shadows, gradients, icons or animation for decoration. Add contrast through spacing and type before adding borders or fills.
5. **Content never needs custom CSS.** If an article needs something the prose styles lack, add a generic, reusable rule (see below), not an article-specific one.
6. **Three languages, two themes, three sizes.** A change is not done until it has been seen in all of them (see the matrix in [responsive-and-accessibility.md](responsive-and-accessibility.md#verification-checklist-for-design-changes)).
7. **Progressive enhancement.** Pages must remain readable without JavaScript. New scripts live in the component that owns the markup.
8. **Update the docs in the same change** (see below).

## Change checklist

Before merging a design change:

- [ ] Uses existing tokens; new tokens are defined for both themes where they are colors.
- [ ] No hard-coded colors or magic widths outside `:root`.
- [ ] Text contrast at least 4.5:1 in both themes; focus indicator visible; state not conveyed by color alone.
- [ ] No horizontal page scroll at 320px; wide content scrolls inside its own box.
- [ ] Looks right in English, Vietnamese and Japanese (long words, no-space text).
- [ ] Looks right at ≥1040px, tablet and ≤600px; the sidebar breakpoint still works.
- [ ] Headings in correct order; interactive elements have accessible names.
- [ ] `npm run build` passes (type and content-schema check plus build).
- [ ] The relevant file in `docs/` is updated (values, constraint map, component notes), and any new inconsistency is listed below.

## Recipes

### Adding a page

1. Put the markup in a new view in `src/views/` using `BaseLayout`; keep `src/pages/` files as thin wrappers (and add a `[lang]` wrapper if the page is localized).
2. Choose `width`: leave the default (`reading`) for text pages. Use `article` only for pages that need the table-of-contents sidebar.
3. Start with `.page-header` (`h1`, optional lead). Put long text in `.prose`.
4. Add strings to `src/i18n.ts` for all languages and, if it belongs in the header, to `NAV_LINKS` in `src/consts.ts`.

### Adding a component

1. Create it in `src/components/` and reuse tokens and an existing class family. Follow the [shared rules](components.md#shared-rules).
2. Style it in `global.css` in the section where it belongs, using a role-based class name.
3. Give it an accessible name and a keyboard path before it is considered finished.
4. Add it to [components.md](components.md).

### Adding content types

Add generic prose rules to `global.css` under `.prose` (and to [visual-system.md](visual-system.md#content-styles-prose)), or a small script in `ArticleView.astro` if structure must change. A new wide type must fill the column and scroll inside its own box (see [layout-and-pages.md](layout-and-pages.md#rules-that-keep-it-consistent)); do not give it its own width.

### Adding a language

1. Add the locale to `LOCALES` and `LOCALE_META` in `src/i18n.ts` and to `i18n.locales` in `astro.config.mjs` (and the sitemap config).
2. Add a full `UI` string set; create `src/pages/[lang]` wrappers (they already read `PREFIXED_LOCALES`).
3. Check the font stack covers the script. Add fallbacks in `global.css` as `:root:lang(xx)` rules.

### Adding or changing a color

Define the token for both light and dark in `:root`, measure contrast against its background, and record it in [visual-system.md](visual-system.md#color).

## Known inconsistencies

These exist in the current implementation. They are recorded so they are not mistaken for intended design. None blocks use of the site.

| # | Issue | Where | Suggested fix |
| --- | --- | --- | --- |
| 1 | **Mixed breakpoint units.** `40rem`, `600px`, `65rem` and `64.99rem` are all used; 40rem (640px) and 600px are close but not equal. | Media queries in `global.css` | Standardise on `rem` and, ideally, merge the two small breakpoints. |
| 2 | **Off-scale sizes.** Several sizes are set directly rather than from the type scale: wordmark and list titles (1.375rem), article `h1`, nav (0.9375rem), table cells (0.9375rem). | `global.css` | Add tokens if they are to be reused. |
| 3 | **Language select outline is faint** (border 1.25:1). | `.lang-switcher select` | Use `--color-text-muted` for the border, as the search input does. |
| 5 | **Unused file.** `src/plugins/rehype-prose-blocks.mjs` is not referenced (the Markdown processor is Sätteri; rehype plugins would need `@astrojs/markdown-remark`, and the wrapping is done by a script instead). | `src/plugins/` | Delete the file. |
| 6 | **README is out of date on JavaScript.** It lists search, copy buttons and the collapsing TOC; the site also has the language select, scroll-spy and table/figure wrapping. | `README.md` | Update the sentence to match the [JavaScript inventory](components.md#javascript-inventory). |
| 7 | **404 page is English only and has hard-coded text,** unlike the rest of the site. | `src/pages/404.astro` | Move strings to `src/i18n.ts`. |
| 8 | **Plain-text code blocks show an empty header bar** with only the Copy button. It is consistent, but visually heavier than needed. | `ArticleView.astro` script | Hide the header when there is no language, or float the button. |
| 9 | **No automated visual or accessibility tests.** Verification is manual (see the checklist). | n/a | Consider a small Playwright screenshot and axe script in CI. |
| 10 | **`welcome.md` links to an unpublished article.** The introductory post links to `/blog/pi-agent-freedom-vs-convenience/`, which is a draft. In production that link is a 404 until the draft is published (in `astro dev` it works). | `src/content/blog/welcome.md` and the `vi/` and `ja/` copies | Publish the draft, or remove the link until then. |
| 11 | **Language select on the 404 page** labels every language "(homepage)", including the current one, because a 404 has no counterpart page. Correct but slightly odd. | `Header.astro` / `404.astro` | Optional: skip the suffix for the current language. |

When you fix one, delete its row and update the affected document.

## Keeping these docs current

- Each document says what it owns. Put a fact in one place and link to it from the others.
- When you change a token or width, update the tables in [visual-system.md](visual-system.md) or [layout-and-pages.md](layout-and-pages.md) in the same change, and the review date in [README.md](README.md).
- Mark anything aspirational as a **Recommendation** or in the table above. Do not describe unimplemented design as current.

## Qiita sync

### Configuration

- Frontmatter (`qiita.publish`, `qiita.visibility`, `qiita.tags`) is validated by `src/content.config.ts`; rendering ignores it.
- `scripts/qiita/allowlist.json` is a second, independent gate: a flagged post whose slug is not listed fails the run. Adding a post takes two edits (allowlist and frontmatter).
- `visibility` is part of the content hash. `limited` is the default; nothing is public until `visibility: public` is committed.
- `scripts/qiita-map.json` maps each slug to its Qiita item (`pending`, `synced` or `unpublishing`). Do not edit it by hand except for the rename and recovery cases below.

### Commands

| Goal | Command |
| --- | --- |
| Preview | `npm run build && npm run qiita:sync` (reads `dist/`, writes `.qiita-preview/<slug>.md`, no network) |
| Publish or update | Automatic after each successful deploy of `main` (see below); or Actions → *Sync to Qiita* with *Dry run* unticked; or locally `QIITA_TOKEN=… npm run qiita:sync -- --apply` after a build |
| Diagram images as a caption plus link instead of hotlinked images | add `--svg link` (the default is `--svg hotlink`, which the probe showed Qiita renders) |
| Unpublish | set `qiita.publish: false`, merge, then `--apply --unpublish <slug> --confirm <slug>` (workflow inputs `unpublish_slug` and `confirm_slug`) |

**Automatic runs.** The *Sync to Qiita* workflow starts by itself when *Deploy to GitHub Pages* completes successfully for a push to `main` (never for pull requests), and checks out exactly the deployed commit, so image URLs are live. Nothing changes on Qiita unless a post is allowlisted, flagged `qiita.publish: true`, and its content hash changed. The sync commits `scripts/qiita-map.json` itself with `GITHUB_TOKEN`, which does not trigger another deploy, so there is no loop.

**Going public.** New items are created with `visibility: limited` (URL-only). After checking the item logged out, change that post's `qiita.visibility` to `public` and push; the next automatic run updates the existing item rather than creating a new one, because `visibility` is part of the hash and the item id is in the map.

Real workflow runs are only allowed from `main` (anywhere else the run fails with an error), so the map is always committed to the branch the next run will read. A local `--apply` run (and any `--recover`, which the workflow has no inputs for) must be followed immediately by committing and pushing `scripts/qiita-map.json`, and must never overlap with a workflow run; forgetting either can create a duplicate Qiita item. Also restrict the `qiita` Environment's deployment branches to `main` in the repository settings.

Images cannot be uploaded through the API, so each diagram becomes a text caption plus a link to the SVG on the blog; the site must already be deployed (the sync checks every asset URL first). Callouts become `:::note info`; any HTML Qiita might mangle stops the run instead of being dropped.

### Recovery

- **`pending` entry** (a create may or may not have succeeded): rerun the sync; it looks for exactly one matching item created after the attempt and adopts it. If it cannot decide, check Qiita and run `--apply --recover <slug> --item-id <id>` (the item exists) or `--apply --recover <slug> --not-created` (it does not). Never delete a `pending` entry by hand without checking Qiita first, or the next run may create a duplicate.
- **`unpublishing` entry**: the delete was interrupted. Rerun the same `--unpublish` command.
- **Rename**: the sync refuses when a mapped slug's file disappears and a new post has the same title. Rename the key in `scripts/qiita-map.json` to the new slug.
- **Runner killed mid-run**: the map artifact may be missing. Check Qiita for a duplicate before rerunning.
- **Push of the map blocked** (branch protection): download the `qiita-map` artifact and commit `scripts/qiita-map.json` yourself.

### Verified and unverified Qiita behavior

Verified from the API docs: create/update/delete endpoints and required fields, item `id` and `url` in responses, the 1000 requests/hour limit, no image upload endpoint. Verified by the live probe (results below): the Bearer header, `private: true` creating a URL-only item, the authenticated-user item listing including limited-sharing items, update and delete, and hotlinked SVG rendering. Still unverified: that limited-sharing items are excluded from Qiita search, which exact tag characters are accepted, and which raw HTML Qiita keeps.

Probe results (2026-10-21, run by the repo owner against a live account with a throwaway limited-sharing item, which was deleted afterwards):

- `GET /authenticated_user` with `Authorization: Bearer <token>`: ok.
- `POST /items` with `private: true`: ok; the response had `private: true`. A limited-sharing item's URL has the shape `https://qiita.com/<user>/private/<id>`.
- Tags: the sent tag `test` came back as `テスト`, so Qiita rewrites tag names; never compare returned tags with sent ones.
- `PATCH /items/:id` (title and body): ok.
- `GET /authenticated_user/items`: ok, and it listed the limited-sharing probe item.
- `PATCH` with 6 tags, and with a tag containing a space and punctuation: both `403 Forbidden` with no explanation. Consistent with the 5-tag limit (also enforced by Qiita CLI's own validator) and tag-format rules, but the reason is not given. The sync keeps its 5-tag cap.
- `DELETE /items/:id`: ok.
- Reported by the owner from a logged-out browser: the item was visible by URL, the hotlinked SVG image rendered and the callouts rendered. Not reported, so still unverified: whether it appears in Qiita search, and how a `<div class="callout">`/`<span>` left as raw HTML renders (the sync converts those anyway and fails closed on any other HTML).
