# Design overview

## What this site is

A personal technical blog about AI agents, software engineering, developer tools, cloud infrastructure and system design. It is a static [Astro](https://astro.build) site published in three languages: English (the default, at the site root), Vietnamese (`/vi/`) and Japanese (`/ja/`).

The articles are long-form and technical. They contain code, tables, diagrams, and claims labelled by how well they are supported (see [Claim labels](components.md#claim-labels-and-callouts)). The design exists to serve that content.

## Intended audience

- Software developers and technically curious engineers reading long articles, often in one sitting.
- Readers of Vietnamese and Japanese as well as English. All three languages are first-class design targets, not translations bolted on.
- Readers on phones, laptops and large monitors, in light or dark mode (the site follows the operating-system setting).

## Goals

1. **Reading comfort first.** A long article should be easy to follow from the first line to the last.
2. **Easy discovery without noise.** A visitor should find recent and relevant articles without a wall of cards, banners or tags.
3. **A personal, editorial voice.** It should feel like a carefully set personal publication, not a corporate or portfolio site.
4. **Technical content is first-class.** Code, tables and diagrams get the room they need and are never squeezed into the text column.
5. **Low maintenance.** Publishing is adding a Markdown file. Design changes happen through shared tokens, not per-article CSS.

## Principles

### Minimalism with purpose

Remove decoration, not information. The design uses typography, spacing and thin rules to create hierarchy instead of cards, shadows, gradients or icons. There are no images on the home page, and there is one accent color. Where something is dropped (for example the old "featured" card), readers can still reach the same content another way.

### Generous whitespace

Whitespace is the main layout tool. Section gaps are large (4rem between home sections, 3.5rem above article `h2`), line height is generous (1.75 in articles), and the page column is narrow. The values are in [visual-system.md](visual-system.md#spacing).

### A comfortable measure

Body text is held to roughly 65–80 characters per line. Articles use a single 46rem column: text, code blocks, tables and diagrams share the same left and right edges, and wider content scrolls inside its own box rather than breaking the grid. See [layout-and-pages.md](layout-and-pages.md#widths).

### Typography carries the hierarchy

Titles and `h2` are set in a serif (Newsreader); body, `h3`, `h4`, navigation and metadata are sans-serif (Be Vietnam Pro); code is monospace (JetBrains Mono). Size and weight steps are large enough that levels are distinguishable without color or ornament.

### Multilingual by design

- Body font Be Vietnam Pro was designed for Vietnamese diacritics; line height is generous because Vietnamese stacks marks above and below the line.
- Japanese text falls back to the operating system's Japanese fonts, with Mincho (serif) for headings to match the Latin serif. Japanese uses strict line breaking and no letter-spacing or uppercase transforms.
- Layout must not depend on English text lengths: lists, headers and the table of contents wrap rather than truncate.

### Accessibility by default

Semantic HTML, visible focus rings, text contrast of 5.4:1 or better, no meaning conveyed by color alone, reduced-motion support, and a working experience without JavaScript wherever practical. Details and gaps are in [responsive-and-accessibility.md](responsive-and-accessibility.md).

### Static and light

No framework runtime, no CSS framework, no icon or UI libraries. The only client-side JavaScript is small, progressive enhancement; see [JavaScript inventory](components.md#javascript-inventory).

## Identity

| Element | Value | Defined in |
| --- | --- | --- |
| Site name (header wordmark, `<title>`, RSS, Open Graph) | `Quang-SGT` | `SITE.title` in `src/consts.ts` |
| Home page heading | `Quang's Blog` | `SITE.blogName` in `src/consts.ts` |
| Copyright / author | `Quang Ho` | `SITE.author` in `src/consts.ts` |
| Tagline | Localized one-liner | `siteDescription` in `src/i18n.ts` |

## What the design deliberately does not have

- A featured-post hero or large cards on the home page. A single "New here? Start with…" link points to the introductory article instead.
- A manual theme toggle. Light and dark follow `prefers-color-scheme`.
- Pagination, comments, ads, newsletter prompts or popups.
- Per-article styling. All articles share one prose style (see [maintenance.md](maintenance.md#adding-content-types)).
