# hdquangsgt.github.io

A personal technical blog built with [Astro](https://astro.build) and deployed to GitHub Pages at <https://hdquangsgt.github.io/>.

It's a static site: Markdown articles in, static HTML out. There's no backend or database, and client-side JavaScript is limited to search, copy-code buttons, and collapsing the table of contents on small screens.

## Requirements

- Node.js **22.22 or newer** (CI uses Node 24). Astro 7 refuses older versions, including 22.17.
- npm (the repo ships a `package-lock.json`)

With nvm, `.nvmrc` selects Node 26:

```sh
nvm use           # reads .nvmrc
```

## Local development

```sh
npm ci            # install exact versions from the lockfile
npm run dev       # http://localhost:4321, live reload
npm run build     # astro check (types + content schema) and production build into dist/
npm run preview   # serve the production build locally
```

Without a local Node install, Docker works too:

```sh
docker run --rm -it -p 4321:4321 -v "$PWD":/app -v hdq-node-modules:/app/node_modules -w /app \
  node:22 sh -c 'npm ci && npm run dev -- --host 0.0.0.0'
```

## Writing an article

1. Create `src/content/blog/<slug>.md`. The filename becomes the URL: `/blog/<slug>/`.
2. Add frontmatter:

   ```yaml
   ---
   title: 'A descriptive title'
   description: 'One or two sentences for the archive, search results, and social previews.'
   pubDate: 2026-10-20            # required; future dates are hidden in production builds
   updatedDate: 2026-10-25        # optional
   category: AI Agents            # one of CATEGORIES in src/consts.ts
   tags: [coding-agents, security]
   featured: false                # the newest featured article is shown on the homepage
   draft: false                   # drafts are visible in `npm run dev` only
   # coverImage:                  # optional; also used as the social preview image
   #   src: ./images/cover.png
   #   alt: 'What the image shows'
   # qiita:                       # optional, Japanese posts only; see "Publishing to Qiita"
   #   publish: true
   #   visibility: limited        # limited (default) or public
   #   tags: [AI, Claude]         # optional, max 5; defaults to the post's tags
   ---
   ```

3. Write Markdown. Put images in `src/content/blog/images/` and reference them relatively (`![Alt text](./images/diagram.svg)`). Always write meaningful alt text.
4. Run `npm run build`. Invalid frontmatter (a missing field, unknown category, or bad date) fails with a message naming the file and field.
5. Commit and push to `main`. The workflow deploys automatically.

The homepage, archive, category and tag pages, search index, RSS feed, and sitemap are all generated from the collection, so nothing else needs editing.

## Languages

The site is published in English (default, at `/`), Vietnamese (`/vi/`), and Japanese (`/ja/`).

- **Translating an article:** copy it to `src/content/blog/<lang>/<same-slug>.md` and translate it. Files with the same slug are linked as translations (language switcher, "Also available in", and `hreflang` tags). Keep `category` as the English value from `src/consts.ts`; it's displayed translated. Image paths gain one `../` (`../images/diagram.svg`).
- **UI text** (navigation, labels, dates, the About page) lives in `src/i18n.ts`.
- **Adding a language:** add it to `LOCALES` and `LOCALE_META` in `src/i18n.ts`, add a `UI` entry, and add it to `i18n.locales` and the sitemap `i18n` option in `astro.config.mjs`.
- Pages are rendered by shared views in `src/views/`. `src/pages/` holds the English routes and `src/pages/[lang]/` the prefixed ones, as thin wrappers.

### Claim labels and callouts

Analysis articles can mark how well-supported a claim is:

```md
<span class="label documented">Documented</span> inline label
(also: verified, observed, opinion, proposal)

<div class="callout verified">

<span class="label verified">Verified</span> A block with **Markdown** inside.
Keep the blank lines after the opening tag and before the closing tag.

</div>
```

## Project structure

```text
.github/workflows/deploy.yml   CI: install, check, build, deploy to Pages
astro.config.mjs               site URL, sitemap, Shiki themes
public/                        favicon, robots.txt, default social image
src/consts.ts                  site title, nav, social links, categories
src/content.config.ts          article schema (validated at build time)
src/content/blog/              articles (Markdown) and their images
src/components/                head/SEO, header, footer, post list, TOC, …
src/layouts/BaseLayout.astro   page shell
src/pages/                     routes: /, /blog/, /blog/[slug]/, category and tag pages,
                               /about/, 404, /rss.xml, /search.json
src/styles/global.css          design tokens and all styles
src/utils/posts.ts             publishing filter, sorting, slugs, reading time
```

## Deployment (GitHub Pages)

The site is configured for a root-level user site: `site: 'https://hdquangsgt.github.io'` with no `base` path.

One-time setup, not done yet:

1. Create a **public** GitHub repository named exactly `hdquangsgt.github.io` under the `hdquangsgt` account.
2. Push this project to its `main` branch, including `package-lock.json`.
3. In the repository, go to **Settings → Pages → Build and deployment → Source** and choose **GitHub Actions**.
4. Watch the **Deploy to GitHub Pages** workflow in the Actions tab. When it finishes, the site is live at <https://hdquangsgt.github.io/>.

After that, every push to `main` redeploys. Pull requests run the same validation and build without deploying.

No secrets are needed: the build uses only public files, and nothing private ends up in the output.

## Publishing to Qiita (optional)

Selected Japanese posts can be mirrored to Qiita. The blog itself is unaffected; the sync lives in `scripts/qiita/` and is never part of the deploy.

A post is published only if **all** of these hold: it is under `src/content/blog/ja/`, its slug is listed in `scripts/qiita/allowlist.json`, and its frontmatter has `qiita: { publish: true }`. Drafts and future-dated posts are skipped. Removing the flag never deletes anything on Qiita.

```sh
npm run test:qiita                          # unit tests (node --test, no extra dependencies)
npm run build && npm run qiita:sync         # dry-run: converts, writes .qiita-preview/, prints the plan, sends nothing
```

Real runs happen from **Actions → Sync to Qiita → Run workflow** (untick *Dry run*), which needs a `qiita` Environment with a `QIITA_TOKEN` secret (token scopes `read_qiita` and `write_qiita`). New items are created as limited sharing until the post says `visibility: public`. See [docs/maintenance.md](docs/maintenance.md#qiita-sync) for recovery and unpublishing.
