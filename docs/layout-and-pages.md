# Page and layout specifications

## Page skeleton

Every page is rendered by `src/layouts/BaseLayout.astro`:

```
<body data-width="reading | article">
  skip link ("Skip to content" → #main)
  <header class="site-header">   .wrap > .header-inner      (components/Header.astro)
  <main id="main" class="wrap">  page content                (views/*.astro)
  <footer class="site-footer">   .wrap > .footer-inner      (components/Footer.astro)
```

Header, main and footer all use the same `.wrap` container, so their left and right edges always align. **Do not give a page its own outer container; set its width through `data-width`.**

Page files in `src/pages/` are thin wrappers. The real markup lives in `src/views/` (`HomeView`, `BlogIndexView`, `TaxonomyView`, `AboutView`, `ArticleView`). Each view exists once and is used by both the English route and the `[lang]` routes, so a layout change applies to all three languages.

## Widths

**There is one content column.** Every block in an article (paragraphs, headings, lists, quotes, callouts, code blocks, tables and figures) fills the same column, `--measure` wide, so their left and right edges align and centered content (images, captions) is centered on the text. Anything that can be wider than the column scrolls inside its own box instead of extending beyond it.

This replaced an earlier two-width scheme (text at 44rem, code/tables/figures up to 53rem). In that scheme, tables and code stuck out 144px past the text, and centered images were centered on the wider box, 72px right of the text's center. A single column removed both problems; there is no separate "wide" width.

The primitives are set on `:root`; the page container is derived on `<body>`. All are in `src/styles/global.css` (the `:root` block and the "Width system" comment under *Layout*).

### Tokens

| Token | Defined as | Value | Meaning |
| --- | --- | --- | --- |
| `--measure` | primitive | **46rem** | The content column width, on every page |
| `--gutter` | primitive | 1.25rem | Horizontal page padding, each side |
| `--toc` | primitive | 14rem | Article table-of-contents column |
| `--toc-gap` | primitive | 2.5rem | Gap between the column and the table of contents |
| `--scroll-min` | primitive | 34rem | Minimum width of tables and large images before they scroll inside their box |
| `--page` | derived | reading: `--measure + 2 × --gutter` = 48.5rem; article: `--measure + --toc-gap + --toc + 2 × --gutter` = **65rem** | **Outer container width, gutters included.** `.wrap` uses it as `max-width`. Always means the same thing |

`--page` is declared on `body` (with the article override on `body[data-width='article']`), **not** on `:root`. A custom property that references another is resolved where it is declared, so declaring it on `:root` would ignore the per-page override. Which mode a page uses is the `width` prop of `BaseLayout` (`reading`, the default, or `article`); only `ArticleView` passes `width="article"`.

`.wrap` is `width: 100%; max-width: var(--page); padding-inline: var(--gutter)` with `box-sizing: border-box`. Header, main and footer all use it, so their text edges align on every page.

### Article grid

At ≥65rem (1040px) the article body is a two-column grid, `minmax(0, --measure) --toc`, with `--toc-gap` between. The container is exactly the column, gap, table of contents and gutters, so it fills **by construction**: there is no leftover strip.

```
|<-------------------- 65rem (--page) -------------------->|
 gutter |<-- 46rem (--measure) -->|<2.5rem>|<- 14rem ->| gutter
          text, code, tables,       gap       table of
          figures: one column                 contents
```

The **breakpoint** is the one value that cannot follow automatically. Media queries cannot read custom properties, so `@media (min-width: 65rem)`, the stacked-layout query (`max-width: 64.99rem`) and the `matchMedia` in `TableOfContents.astro` are written out and must equal the article `--page`. If you change `--measure`, `--toc`, `--toc-gap` or `--gutter`, update all three.

Below 65rem there is one column. `.article-body` is capped at `--measure`, so the collapsed table-of-contents box shares the text column's edges.

### Why 46rem

The width is a compromise. Rendering the real article in English, Vietnamese and Japanese at three widths (18px body) gave these characters per line (average / longest):

| Width | English | Vietnamese | Japanese |
| --- | --- | --- | --- |
| 42rem | 67 / 75 | 68 / 74 | 39 / 44 |
| 44rem | 70 / 80 | 72 / 78 | 40 / 44 |
| **46rem** | **75 / 82** | **73 / 79** | **41 / 47** |

44rem was chosen for text alone, when text had its own measure. With one column shared by code and tables (which need room), 46rem was chosen to use the available space better. It is at the upper end of comfortable for English (about 75 on average, 82 at most). If long paragraphs feel too wide, set `--measure` back to `44rem` and update the breakpoint to `63rem` (44 + 2.5 + 14 + 2.5 = 63); everything else follows. Revisit if the body font or size changes.

### Shrink safety

The article grid's first column is `minmax(0, --measure)`, so it can shrink below 46rem. This matters when a classic scrollbar (about 15px) takes viewport width without changing the media-query result. Tested at a 1040px viewport with 0, 15, 40, 100 and 200px removed: the columns narrow, the table of contents never overlaps the text, code and table boxes narrow with them, and the page has no horizontal overflow.

### Constraint map

Where each width is applied. Search for these selectors when something looks mismatched.

| Selector | Constraint | Applies to |
| --- | --- | --- |
| `.wrap` | `max-width: --page` | Header, main, footer |
| `.article-header` | `max-width: --measure` | Article title block |
| `.article-body` (<65rem) | `max-width: --measure` | Stacked article body, including the table-of-contents box |
| `.article-body` (≥65rem) | grid `minmax(0, --measure) --toc`, gap `--toc-gap` | Article body |
| `.prose` | `max-width: --measure` | Rendered Markdown wrapper; **every block inside fills it, with no per-block widths** |
| `.article-footer` | `max-width: --measure` | Related posts, pager |
| Home, list and page-header elements | None; fill the column | Everything on reading pages |

### Rules that keep it consistent

- Do not set `max-width` or `width` on individual prose blocks. If a block needs to be narrower, wrap it; if wider, make it scroll.
- Center things with `margin-inline: auto` or `text-align: center` **inside the column** (as figures do), never relative to the viewport or the container.
- Tables are `width: 100%` of the column with a `--scroll-min` minimum; code blocks fill the column and scroll their lines; large images keep `--scroll-min` and scroll.

### Intentional exceptions

- The article container (65rem) is wider than the text column because it also holds the table of contents. Below 65rem that room is not reserved.
- Large images and tables keep a `--scroll-min` (34rem) minimum on narrow screens and scroll inside their own box rather than shrinking to illegibility.

## Navigation

**Header** (`components/Header.astro`): a flex row that wraps.

1. Wordmark `SITE.title` (serif, 22px), linking to the localized home. It takes the free space (`margin-right: auto`), pushing the rest right.
2. Primary nav: Blog, About, RSS. Links are defined in `NAV_LINKS` (`src/consts.ts`); labels in `src/i18n.ts`. The current page gets a 2px accent underline and `aria-current="page"`.
3. Language `<select>`. It lists English, Tiếng Việt and 日本語; choosing one navigates to the same page in that language. Options without a translation are labelled `(homepage)` and go to that language's homepage. Without JavaScript the select is hidden and plain `EN / VI / JA` links show instead.

On narrow screens the header wraps: wordmark, then nav, then the language select on its own row.

**Footer** (`components/Footer.astro`): copyright on the left; GitHub, RSS and Sitemap links on the right, wrapping on narrow screens.

**Skip link**: first focusable element; visible on focus.

## Page specifications

All pages exist in three languages with the same structure.

### Home (`/`, `/vi/`, `/ja/`): `HomeView.astro`, reading width

1. **Intro**: `h1` `SITE.blogName`; lead paragraph (`siteDescription`, 19px muted); an optional **start-here** line; topic links.
   - The start-here line ("New here? Start with <title>") shows only when a published post in that language has `featured: true`. There is no fallback, so nothing is promoted by accident. The introductory article ("About this blog…") is the one marked.
   - Topic links are the categories that have posts, as plain muted text links (no chips, no counts).
2. **Recent articles** (4rem below the intro): a small uppercase label, then the post list showing the newest `RECENT_POSTS_LIMIT` posts (8, in `src/consts.ts`), then "All N articles →".
3. **Empty state**: if there are no posts, a single muted line (`home.noPosts`) replaces the section.

Order of posts is always newest first. The list is the only listing on the page. See [PostList](components.md#postlist).

### Blog index (`/blog/`): `BlogIndexView.astro`, reading width

Page header (`h1`, lead) → search box → category and tag chips → full post list. The search form is `hidden` in the HTML and revealed by JavaScript, so it never appears when it can't work. With no posts, the list is replaced by `home.noPosts`. Search results filter the list in place (`.post-item[hidden]`) and show a status line and an empty-result message with a "clear the search" link.

There is no pagination. If the archive grows large, see [Recommendation](#recommendations).

### Category and tag pages (`/blog/category/<slug>/`, `/blog/tags/<slug>/`): `TaxonomyView.astro`, reading width

Breadcrumb eyebrow ("Blog / Category") → `h1` (category name, or `#tag`) → article count → chips (current one highlighted with `aria-current="page"`) → post list.

### About (`/about/`): `AboutView.astro`, reading width

Page header, then one `.prose` block: intro paragraph, then `h2` sections (technical interests, what you'll find here, elsewhere). Copy comes from `UI.<lang>.about` in `src/i18n.ts`, not from Markdown.

### Article (`/blog/<slug>/`): `ArticleView.astro`, article width

1. **Header** (max 46rem), in order of emphasis:
   - A top bar: "← All articles" on the left and "Also available in: …" (other languages that have this article) on the right. They share a line and wrap below each other on narrow screens.
   - `h1` and description (19px muted): the most prominent elements.
   - One compact meta line: date, "Updated" date if any, reading time, and a status badge for drafts or scheduled posts.
   - A quieter second line: category (linked) and tags.
2. **Body**: a 1px rule, then the table of contents and the prose.
   - The TOC is built from `h2` and `h3` headings and rendered only when there are at least two.
   - At ≥65rem it sits in the right column and is sticky; below that it is a collapsible box above the text.
3. **Footer** (max 46rem, 4rem below the body, with a rule): up to three related articles (ranked by shared tags, weighted ×2, then same category), an Older / Newer pager, and a "Back to all articles" link.

Drafts and future-dated posts are hidden from production builds and shown, labelled, in `astro dev`.

### 404: `src/pages/404.astro`, reading width

Eyebrow "404", `h1`, a lead with links to the archive and home, and the three most recent articles. Marked `noindex`.

### Non-visual routes

`/rss.xml` and `/search.json` (each also per language), `sitemap-index.xml`. They have no visual design but use `SITE.title`.

## Recommendations

- **Archive growth.** The blog index renders every post in one list. Past roughly 50 posts, consider grouping rows under year headings (keeping the same row design) rather than adding pagination. Not implemented.
- **Home limit.** `RECENT_POSTS_LIMIT` is a single constant; raise or lower it without touching markup.
