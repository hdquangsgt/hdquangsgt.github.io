# Visual design system

All values below come from `src/styles/global.css` (tokens at the top of the file) and `astro.config.mjs` (fonts). Use the CSS custom properties, not the literal values, when writing styles. `rem` values assume the browser default of 16px.

## Typography

### Font families

| Role | Family | Weights | Token | Used for |
| --- | --- | --- | --- | --- |
| Body / UI | Be Vietnam Pro | 400, 500, 600, 700 (+ italics) | `--font-sans` | Body text, `h3`, `h4`, navigation, metadata, buttons |
| Headings | Newsreader | 500, 600 | `--font-serif` | Page titles (`h1`), `h2`, site wordmark, list titles, pager titles |
| Code | JetBrains Mono | 400, 600 | `--font-mono` | Inline code, code blocks, tags, counts |

Fonts are fetched from Google Fonts at **build time** and self-hosted, so pages make no runtime requests to Google. Subsets: Latin, Latin Extended and Vietnamese. The Latin body and heading fonts are preloaded (`BaseHead.astro`), using the Vietnamese subset on `/vi/` pages. Astro generates size-adjusted fallbacks to limit layout shift while fonts load.

**Fallbacks.** Newsreader falls back to Georgia, then `serif`. Be Vietnam Pro falls back to `system-ui`.

**Japanese** (`:root:lang(ja)`): Latin text keeps Be Vietnam Pro / Newsreader. Kana and kanji come from the OS: Hiragino Sans, Hiragino Kaku Gothic ProN, Noto Sans JP, Yu Gothic or Meiryo for sans; Hiragino Mincho ProN, Yu Mincho or Noto Serif JP for serif headings. No Japanese web font is shipped.

Other language rules: `:lang(ja)` uses `line-break: strict`, `word-break: auto-phrase` on headings, and no negative letter-spacing; uppercase label transforms are disabled for Japanese.

### Type scale

| Token | Size | Used for |
| --- | --- | --- |
| `--text-xs` | 0.8125rem (13px) | Section labels, claim labels, status badge, TOC heading |
| `--text-sm` | 0.875rem (14px) | Metadata, dates, captions, TOC, tags, language select |
| (body default) | 1rem (16px) | Page body, list descriptions, callout text |
| `--text-base` | 1.125rem (18px); 1.0625rem (17px) at ≤600px | Article body |
| `--text-md` | 1.1875rem (19px) | Lead paragraphs and descriptions |
| `--text-lg` | 1.25rem (20px) | Article `h3`, pager titles |
| `--text-xl` | `clamp(1.5rem, 1.3rem + 0.9vw, 1.75rem)` (24–28px) | Article `h2` |
| `--text-2xl` | `clamp(2.125rem, 1.6rem + 2.2vw, 3rem)` (34–48px) | Page titles and home `h1` |

Not on the scale (set directly in the stylesheet): site wordmark 1.375rem, list titles 1.375rem, article `h1` `clamp(2rem, 1.6rem + 1.6vw, 2.625rem)`, navigation 0.9375rem, code 0.875rem, table cells 0.9375rem.

### Line height

| Context | Value |
| --- | --- |
| Article body (`--leading`) | 1.75 |
| Page body (`body`) | 1.6 |
| Lead / description paragraphs | 1.65 |
| Headings (`--leading-heading`) | 1.25 (home `h1` 1.1, article `h1` 1.15, list titles 1.3) |
| Code blocks | 1.65 |
| Tables, TOC | 1.55 / 1.5 |

Heading letter-spacing is `-0.01em` (titles `-0.02em`). Headings use `text-wrap: balance`; paragraphs and list items use `text-wrap: pretty`.

### Heading hierarchy (articles)

| Level | Font | Size | Weight | Margin (top / bottom) | Color |
| --- | --- | --- | --- | --- | --- |
| `h1` (title) | Serif | 32–42px | 600 | 0 / 1rem | text |
| `h2` | Serif | 24–28px | 600 | 3.5rem / 1rem | text |
| `h3` | Sans | 20px | 600 | 2.5rem / 0.75rem | text |
| `h4` | Sans | 18px | 600 | 1.5rem / 0.5rem | muted |

A heading that directly follows `h2` or `h3` uses a 1rem top margin instead. There is no divider, icon or anchor decoration on headings. Only titles and `h2` are serif, so the sans `h3` and `h4` read as subordinate. Article headings are written as `##`–`####` in Markdown; the page `h1` comes from frontmatter `title`.

Page-level (non-article) hierarchy: `h1` serif at `--text-2xl`; section labels are small uppercase sans (`.section-label`, 13px, 600, `0.08em` tracking); list titles are serif 22px.

## Spacing

An eight-step scale of tokens (`--space-*`) plus a few explicit values.

| Token | Value |
| --- | --- |
| `--space-1` | 0.25rem (4px) |
| `--space-2` | 0.5rem (8px) |
| `--space-3` | 1rem (16px) |
| `--space-4` | 1.5rem (24px) |
| `--space-5` | 2.5rem (40px) |
| `--space-6` | 4rem (64px) |

Key rhythms:

| Where | Value |
| --- | --- |
| Page gutter (`--gutter`) | 1.25rem each side |
| `<main>` top padding | 4rem (2.5rem at ≤600px) |
| Between home sections | 4rem |
| Footer top margin | 6rem |
| Post list row | 1.5rem padding above and below |
| Post list columns | 8.5rem date column, 1rem gap |
| Paragraphs, lists, quotes (in prose) | 1.25em bottom margin |
| List items | 0.5rem apart |
| Code block, table, figure | 1.5rem / 1.75rem bottom margin |
| Article header to body | 2.5rem below the header, then a 1px rule and 1.5rem padding |

## Content widths

Widths are layout-critical and are documented, with their relationship to containers, in [layout-and-pages.md](layout-and-pages.md#widths).

## Color

Light is the default. Dark applies under `@media (prefers-color-scheme: dark)`. Both sets are tokens on `:root`. The `<meta name="color-scheme">` tag lets form controls follow the theme. The palette is warm-neutral with one green accent.

### Core tokens

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `--color-bg` | `#fbfaf7` | `#151513` | Page background |
| `--color-surface` | `#f3f1ea` | `#1d1d1a` | Table headers, zebra rows, neutral callout |
| `--color-text` | `#1f1e1b` | `#e8e6e1` | Body text, headings |
| `--color-text-muted` | `#5c5851` | `#a9a59b` | Metadata, descriptions, secondary links |
| `--color-border` | `#e5e1d7` | `#2f2e2a` | Rules, dividers, outlines |
| `--color-accent` | `#0b6b52` | `#5cc8a3` | Links, current page, active TOC bar |
| `--color-accent-hover` | `#075240` | `#86dcbd` | Link hover |
| `--color-focus` | `#1a5fd0` | `#7fb0ff` | Keyboard focus ring |
| `--color-code-bg` | `#f6f8fa` | `#0d1117` | Code blocks and inline code |

### Measured contrast (WCAG 2.x, against `--color-bg`)

| Pair | Light | Dark |
| --- | --- | --- |
| Text | 15.97:1 | 14.66:1 |
| Muted text | 6.77:1 | 7.44:1 |
| Accent (links) | 6.21:1 | 8.92:1 |
| Focus ring | 5.60:1 | 8.32:1 |
| Border | 1.25:1 | 1.35:1 |

Text and link pairs exceed 4.5:1 (AA). Borders are decorative dividers, so their low contrast is intentional; see [Known inconsistencies](maintenance.md#known-inconsistencies) for the one place it matters (the language select).

### Claim-label colors

Six semantic label colors, each with a foreground and a tinted background token, in both themes: `documented` (blue), `verified` (green), `observed` (amber), `opinion` (purple), `proposal` (rust) and `author-input` (magenta, for placeholders the author must resolve). All foreground/background pairs measure at least 5.4:1 in light and 7.6:1 in dark. Meaning is always carried by a text label as well as color; see [components.md](components.md#claim-labels-and-callouts).

## Borders, radius and surfaces

- Borders are always `1px solid var(--color-border)`, except: table header underline 2px, callout and TOC accent bars 3px/2px, and the `.status` badge (1px, `currentColor`).
- Radius is `--radius` (6px) for blocks, 4px for inline code, and fully rounded (999px) only for topic chips.
- No shadows, gradients or blurs anywhere.
- Surfaces are flat: a block is distinguished by a 1px border or by `--color-surface`, never by elevation.

## Content styles (`.prose`)

Rendered Markdown is wrapped in `.prose`. All article content types share these rules.

| Content | Treatment |
| --- | --- |
| Paragraph | 18px, 1.75 line height, held to the text measure |
| Links | Accent color, 1px underline offset 0.18em (2px on hover), long URLs wrap (`overflow-wrap: anywhere`) |
| Lists | 1.5rem left padding, 0.5rem between items |
| Blockquote | 3px left border (`--color-border`), muted color, 1.5rem left padding. **Upright, not italic.** Use `<em>` inside for emphasis |
| Inline code | JetBrains Mono 0.875em, code background, 1px border, 4px radius |
| Code block | Bordered box with a header bar; see below |
| Table | Bordered scroll box; header row on `--color-surface` with a 2px underline; body rows separated by 1px lines; even rows tinted 50% `--color-surface`. The table fills the content column; cells have a 5rem minimum width and the table a 34rem minimum (`--scroll-min`), so narrow screens scroll instead of squeezing columns |
| Figure / diagram | Centered image with a 1px border and 6px radius; optional caption (14px, muted, centered) |
| Horizontal rule | 1px `--color-border`, 2.5rem above and below |
| Callout | Tinted box with a 3px left bar; see [components.md](components.md#claim-labels-and-callouts) |

### Code blocks

- Syntax highlighting is Shiki with dual themes: `github-light` and `github-dark`, switched by the OS preference (`astro.config.mjs`). Highlight colors come from Shiki; the **block background** is overridden with `--color-code-bg` so it matches the palette.
- Font: JetBrains Mono 0.875rem, line height 1.65, tab size 2, 1rem padding, no wrapping (long lines scroll horizontally inside the block).
- The header bar (2.5rem tall) shows the language and a **Copy** button. The language is shown only when the Markdown fence names one (and it is not `text`, `plaintext` or `txt`). No filename is ever invented.
- Code blocks fill the content column, the same width as the text.

### Diagrams and images

- Markdown images alone in a paragraph become figures. The Markdown title is the caption: `![alt](src "Caption")`. No title means no caption.
- Alt text is required for cover images by the content schema; write meaningful alt text for every diagram. It is the accessible description, so for diagrams it should explain the diagram.
- Figures and diagrams fill the content column, centered in it. At ≤40rem, large images (intrinsic width of 480px or more, which covers the diagrams) keep a 34rem minimum width inside a horizontally scrolling, keyboard-focusable box, so labels stay legible. Smaller images simply scale down.

## Interaction styles

| State | Style |
| --- | --- |
| Focus (`:focus-visible`) | 3px solid `--color-focus`, 2px offset |
| Link hover | Accent hover color, thicker underline |
| List title hover | Accent color, underlined |
| Nav item (current page) | Primary text color with a 2px accent underline |
| TOC item (current section) | 2px accent bar on the left, primary text color, weight 600 |
| Copy button | Muted; border appears on hover; "Copied" in green, "Copy failed" in rust for 2 seconds |

Animation is limited to smooth in-page scrolling (`scroll-behavior: smooth`), applied only under `prefers-reduced-motion: no-preference`. A `prefers-reduced-motion: reduce` rule disables all transitions and animation.
