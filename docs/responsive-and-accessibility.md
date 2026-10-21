# Responsive behavior and accessibility

## Breakpoints

The site is mobile-first in spirit but written as a single stylesheet with a few targeted media queries. These are all of them:

| Breakpoint | Query | What changes |
| --- | --- | --- |
| Article sidebar | `min-width: 65rem` (1040px) | Article body becomes two columns with a sticky table of contents. Below this, the TOC is a collapsible box. (A `max-width: 64.99rem` query styles the box.) |
| Stacked list rows | `max-width: 40rem` (640px) | Post list rows stack: date above the title. Large images (intrinsic width ≥ 480px) in articles keep a 34rem minimum width and scroll inside their box. |
| Phone | `max-width: 600px` | Article body text 17px (from 18px); `<main>` top padding 2.5rem (from 4rem); pager stacks vertically. |
| Color scheme | `data-theme='dark'` on `<html>` (reader's choice; the OS setting is ignored) | Dark tokens, Shiki dark theme and dark diagram rules. |
| Motion | `prefers-reduced-motion: no-preference` / `reduce` | Smooth scroll only when allowed; `reduce` disables transitions and animation. |

Smallest supported width: `body { min-width: 20rem }` (320px). Fluid values (`clamp()`) cover everything between breakpoints: heading sizes scale with the viewport and have no breakpoints of their own.

**Known inconsistency:** the two small breakpoints use different units (`40rem` and `600px`). See [maintenance.md](maintenance.md#known-inconsistencies).

## Behaviour by screen size

| | Desktop (≥1040px) | Tablet (≈641–1039px) | Mobile (≤640px) |
| --- | --- | --- | --- |
| Reading pages (home, lists, about) | 46rem column, centered; header and footer share it | Same column, narrowing as the window does; 1.25rem gutters | Fills the width minus gutters |
| Article page | 65rem container: one 46rem column (text, code, tables, figures) + sticky TOC on the right | Single column; collapsible TOC box above the text; One column up to 46rem; TOC box shares its edges | Single column; 17px text at ≤600px; TOC collapsed |
| Header | One row | One row, may wrap | Wordmark, nav, then language select wrap onto separate rows |
| Post list | Date column beside title | Date column (until 640px) | Date above title |
| Code, tables | Fill the 46rem column | Fill the column and scroll if needed | Scroll inside their own box |
| Diagrams | Centered in the column | Scale to the column | Large images (diagrams, screenshots) scroll horizontally at a 34rem minimum so text stays legible; small images scale |
| Pager | Older left, newer right | Same | Stacked |

### Rules for handling overflow

1. The page itself must never scroll horizontally. Anything wider than its container scrolls inside its own `overflow-x: auto` box (`.table-wrap`, `.figure-scroll`, `pre`).
2. Long words and URLs wrap (`overflow-wrap: anywhere` on prose links, inline code and list titles).
3. Titles wrap; nothing is truncated with an ellipsis.
4. Text size never drops below 14px; body text is 16–18px.

## Multilingual layout

The same CSS serves all languages. Checks that apply to any change:

- Test Vietnamese (long words, stacked diacritics) and Japanese (no spaces, so wrapping relies on `line-break: strict`).
- The date column (8.5rem) fits `Oct 19, 2026`, `19 thg 10, 2026` and `2026年10月19日`. A longer locale format could overflow it.
- Header items and TOC entries wrap; do not give them fixed widths.
- Do not use uppercase transforms or negative letter-spacing on Japanese (already handled for labels and headings).

## Accessibility

### Implemented

| Area | Practice |
| --- | --- |
| Structure | Landmarks: `header`, `nav` (labelled "Main", topics, TOC, pager), `main#main`, `footer`. One `h1` per page; headings nest without skipping (home: `h1` → `h2` → `h3` titles; articles: `h1` → `h2` → `h3`). `ol` for article lists. `<time datetime>` for dates. |
| Skip link | "Skip to content" is the first tab stop and jumps to `#main`. |
| Language | `<html lang>` is set per page; localized strings live in `src/i18n.ts`; option and link `lang` attributes are set for other-language items. |
| Keyboard | Everything interactive is a native control (link, button, select, `details`) and reachable in DOM order. Scrollable regions (code, tables, diagram boxes) are focusable. No keyboard traps. |
| Focus | `:focus-visible` shows a 3px `--color-focus` outline with a 2px offset on every focusable element. |
| Contrast | Text 14.7–16:1, muted text 6.8–7.4:1, links 6.2–8.9:1, claim label pairs ≥5.4:1. See [visual-system.md](visual-system.md#measured-contrast-wcag-2x-against---color-bg). |
| Color not alone | Current page: underline plus `aria-current="page"`. Current TOC entry: bar plus weight plus `aria-current="location"`. Claim types: written labels. Draft status: a text badge. Chips: filled state plus `aria-current`. |
| Reading size | Body 18px (17px on phones), line height 1.75, measure 46rem (~75 characters on average in English and Vietnamese; ~40 for Japanese), no text smaller than 13px (labels only). |
| Names | The language select, TOC (`aria-labelledby`), tag list, search input (label) and copy buttons (`aria-label`) all have accessible names. Counts on chips have `aria-label`s ("3 articles"). |
| Dynamic updates | Search results count: `aria-live="polite"`. Copy result: `role="status"` region. |
| Motion | Smooth scrolling only without a reduced-motion preference; all transitions disabled under `reduce`. |
| Without JavaScript | Content, navigation, TOC links, the language links and tables/code all work; only search, copy and scroll-spy are lost. |
| Images | Diagrams need meaningful `alt`; cover images require `alt` in the content schema. |

### Practice for new work

- Use real headings in order; do not pick a heading level for its size.
- Interactive elements need a visible focus state, an accessible name and a target at least about 2rem tall (chips 2.25rem, copy button 2rem, select 2.25rem).
- State via text, shape or position as well as color.
- Write descriptive alt text; for diagrams, describe what the diagram shows, not that it is a diagram.

### Known gaps

These are not yet addressed; see also [maintenance.md](maintenance.md#known-inconsistencies).

- The language select's border uses `--color-border` (about 1.25:1), below the 3:1 recommended for UI component boundaries (WCAG 1.4.11). The text is readable; the control's outline is faint.
- Diagram SVGs are inlined and follow the chosen theme. Verified in both themes: no text/background pair below 4.5:1 among 393 labels in 16 diagrams.
- Screen-reader testing and an automated audit (axe or Lighthouse) have not been run. Items above were checked by inspecting markup and CSS, and keyboard behaviour was exercised in a browser.

## Verification checklist for design changes

Run through this matrix when changing layout or styles. It is a representative set, not every combination.

| Pages | Widths | Themes | Languages |
| --- | --- | --- | --- |
| Home, Blog index, About, short article, long article with code/table/diagram | 1280, 1040 (and 1039), ~820, 390 | Light and dark | English, Vietnamese, Japanese |

For each, check: no horizontal page scroll; text edge aligned with the header; headings, spacing and contrast look right; wide content scrolls inside its box on mobile. Functionally: TOC navigation and highlighting, mobile TOC toggle, copy button, language switching, keyboard tab order and focus rings, console errors. Build checks: `npm run build` (runs `astro check`).

Note that drafts only appear under `npm run dev`, so a long article with code or tables may need a draft or a temporary page to test.
