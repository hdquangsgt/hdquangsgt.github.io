# Component design

Components live in `src/components/` (Astro components) and `src/views/` (page-level compositions). All styling is in `src/styles/global.css`; there are no scoped styles. This document lists each component with its purpose, markup hooks and usage rules. Values (sizes, colors) are in [visual-system.md](visual-system.md).

## Shared rules

These keep components consistent. Follow them when adding or changing anything.

1. **Tokens, not literals.** Colors, spacing, type sizes, widths and radius come from the `:root` custom properties. If a value is missing, add a token rather than hard-coding it.
2. **One owner per pattern.** A pattern (a post row, a meta line, a chip) is rendered by exactly one component and reused. Do not copy markup between views.
3. **Class names describe the role**, not the look: `.post-item`, `.toc`, `.callout`. Modifiers are second classes (`.callout.observed`, `.chip-tag`).
4. **Muted for secondary.** Anything secondary (dates, descriptions, counts, captions) uses `--color-text-muted` at 14–16px. Primary text uses `--color-text`. Accent is reserved for links, the current page or section, and hover.
5. **Serif for titles only.** List titles, page titles, `h2` and the wordmark are serif. Everything interactive or informational is sans.
6. **No decoration to signal state.** Current page and section use an underline or bar plus `aria-current`; status and claim types use text labels. Color is never the only signal.
7. **Localized text from `src/i18n.ts`.** No user-visible string is hard-coded in a component (the one exception is the 404 page, which is English only).
8. **Wide things scroll themselves.** Anything that can exceed its column (tables, code, diagrams) gets its own `overflow-x: auto` box; nothing may widen the page.

## Layout and navigation components

### `Header.astro`, `Footer.astro`

Site chrome; see [layout-and-pages.md → Navigation](layout-and-pages.md#navigation). Take no styling props. The header receives `alternates` (the URL of this page in each language) from `BaseLayout` and uses it for the language select.

### Language select (in `Header.astro`)

A native `<select data-lang-select aria-label="Language">`, `hidden` until its script runs; each `<option value>` is the target URL. A `change` handler sets `window.location`. A `pageshow` handler resets the selection when the browser restores the page from its back/forward cache. Inside `<noscript>` there is a plain link list (`.lang-links`). Native element, so keyboard and screen-reader behaviour is built in.

### Page header (`.page-header`, `.eyebrow`, `.page-lead`)

Used by Blog index, category and tag pages, About and 404: `h1` at `--text-2xl`, optional muted lead (19px) and an optional small muted eyebrow (breadcrumb or "404") above. 2.5rem below.

### Section label (`.section-label`)

Small (13px) uppercase sans label that titles a block, for example "Recent articles". Rendered as an `h2` for document structure but styled as a label. Uppercase and tracking are disabled for Japanese.

## Article list components

### PostList

`components/PostList.astro`. A single `<ol class="post-list">`; used by Home, Blog index, category and tag pages, related articles and the 404 page.

Row (`li.post-item[data-post-id]`), a two-column grid (8.5rem date column, then body), stacking at ≤40rem:

| Part | Markup | Notes |
| --- | --- | --- |
| Date | `p.post-item-date` with `FormattedDate` | 14px muted, tabular figures |
| Title | `h2` or `h3.post-item-title > a` (prop `headingLevel`) | Serif 22px; hover underlines in accent; wraps long titles (`overflow-wrap: anywhere`) |
| Status | `span.status` | Only for drafts or scheduled posts (visible in dev) |
| Description | `p.post-item-description` | 16px muted; omitted if empty |
| Meta | `p.post-item-meta` | Reading time and linked category, 14px muted |

Rules:

- Choose `headingLevel` so headings nest correctly: `h2` when the list sits directly under the page `h1`, `h3` under an `h2` section.
- Rows have no tags, images or card chrome. The list has a 1px rule above and between rows.
- The Blog index search depends on `.post-item[data-post-id]`. Keep that attribute and class if you change the markup.

### PostMeta

`components/PostMeta.astro`. The compact meta line in the article header: date, "Updated" date if any, reading time, status badge. The category and tags are a separate, quieter line rendered by `ArticleView`. 14px muted, wraps. Reading time is computed in `utils/posts.ts` (220 words per minute; for Japanese, 500 characters per minute).

### FormattedDate

`components/FormattedDate.astro`. A `<time datetime>` formatted with the page language's locale (`en-US`, `vi-VN`, `ja-JP`), always in UTC so a calendar date never shifts by a day. Use it for every date.

### TagList

`components/TagList.astro`. `ul.tag-list` of `#tag` links in monospace 13px muted, separated by 0.5rem. Used in the article header. Tag pages are at `/blog/tags/<slug>/`.

### TopicNav (chips)

`components/TopicNav.astro`. Category and tag chips for the Blog index and taxonomy pages: bordered pills 2.25rem tall (a touch target), count in monospace. The current chip is filled with the accent color and carries `aria-current="page"`. Home uses plain text topic links (`.topic-links`) instead, deliberately quieter.

## Article components

### Prose (`.prose`)

The wrapper for all rendered Markdown (articles and the About page). Defines the content styles listed in [visual-system.md](visual-system.md#content-styles-prose) and the width rules in [layout-and-pages.md](layout-and-pages.md#constraint-map). The wrapper carries `data-copy*` attributes holding the localized copy-button labels.

### TableOfContents

`components/TableOfContents.astro`. `nav.toc` containing `details[data-toc] > summary + ol`. Entries are `h2` and `h3` (an `h3` is indented and smaller).

- **Without JavaScript:** a list of in-page links, open at every width. Fully usable.
- **≥65rem:** always open and not collapsible (a script keeps `details.open` true and ignores clicks on the summary), sticky at the top of the viewport (`top: 1.5rem`, max height `100vh − 3rem`, scrolls itself if long).
- **<65rem:** a bordered box above the article, collapsed by default; the summary toggles it.
- **Current section:** a scroll-spy marks the active entry with `aria-current="location"`, a 2px accent bar and weight 600. It uses `IntersectionObserver` (a band covering the top 30% of the viewport), not scroll events, so it does little work while scrolling. In a long sidebar, the active entry is kept in view.
- Headings jump to their anchor; `html { scroll-padding-top: 2.5rem }` keeps them from sitting at the very top edge. Nothing sticky overlaps the content.

### Code block

Built by the article script from Shiki's `<pre class="astro-code" data-language>`. Structure: `div.code-block > div.code-head (span.code-lang, button.copy-button, span[role=status].visually-hidden) + pre`.

- The copy button is shown only when the Clipboard API exists. It gives text feedback ("Copied" or "Copy failed", 2 seconds), a data attribute for styling (`data-state`), and an announcement through the status region.
- The `pre` is keyboard-focusable (Shiki sets `tabindex="0"`) so long lines can be scrolled with the arrow keys.
- Without JavaScript the bare `pre` still scrolls and is styled (no header).

### Table wrapper and figure

The article script wraps each top-level `<table>` in `div.table-wrap` and each image alone in a paragraph in `figure.figure > div.figure-scroll + figcaption`. Both scroll boxes are `tabindex="0"` so keyboard users can scroll them. Images whose intrinsic `width` is 480 or more get `figure-scroll-wide`, which keeps them at `--scroll-min` on narrow screens (decided from the width, not the file name, because image URLs differ between dev and production). The `<table>` itself stays a real table. Without JavaScript, a bare top-level table is a scrollable block (`.prose > table`) and an image is a centered image.

### Claim labels and callouts

Raw HTML in Markdown, using classes defined in `global.css`. Six kinds map to the label colors: `documented`, `verified`, `observed`, `opinion`, `proposal` and `author-input`.

```html
<div class="callout observed">

<span class="label observed">Observed</span> Text of the claim, with **Markdown** as usual.

</div>
```

- `.label.<kind>` is an inline tag; the **word is always written out** ("Observed"), so the meaning never depends on color. Use it inline in lists or paragraphs, or at the start of a callout.
- `.callout` is a block with a 3px left bar and a tinted background. `.callout.<kind>` takes that kind's colors; `.callout` alone is the neutral style (surface background), used for reading notes. `author-input` has a dashed bar to mark unfinished placeholders.
- Inside a callout, the label has no background, so it reads as a lead-in word.
- Leave a blank line after `<div ...>` and before `</div>` so the content is parsed as Markdown.

### Pager and related articles (`.article-footer`)

"Related articles" is a PostList of up to three posts. The pager is a flex row: older on the left, newer on the right, each showing "Older" or "Newer" over the serif title; it stacks at ≤600px. Missing neighbors leave an empty slot, not a broken link.

### Translations line

"Also available in: …" sits on the right of the article header's top bar, beside the back link (`.post-translations`), and lists only languages that have this article. Languages without it are not linked.

## Search (Blog index)

`<form data-search hidden>` with a labelled input, filtered client-side against the language's `search.json` (title, description, category, tags and full text). Hidden rows get the `hidden` attribute. A live region (`aria-live="polite"`) reports "N of M articles match." Without JavaScript the form stays hidden and the full list is shown. If the index cannot be fetched (offline, blocked), the form hides itself and the full list is restored, so a broken search is never offered.

## JavaScript inventory

All scripts are small, inline, load only where needed and degrade to working HTML.

| Script | Location | Purpose |
| --- | --- | --- |
| Language select | `Header.astro` | Reveal the select; navigate on change; reset on back/forward restore |
| TOC state and scroll-spy | `TableOfContents.astro` | Open/closed per breakpoint; mark the current section |
| Table and figure wrapping | `ArticleView.astro` | Scroll boxes; figure captions |
| Code block header and copy | `ArticleView.astro` | Language label; copy button |
| Archive search | `BlogIndexView.astro` | Filter the list |

Add a new script only for behaviour that HTML and CSS cannot provide, keep it inside the component that owns the markup, and make the no-JavaScript state acceptable.
