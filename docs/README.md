# Design documentation

Documentation for the design of this blog (<https://hdquangsgt.github.io/>). It describes the design **as implemented in the code**. Recommendations and known inconsistencies are always called out in their own sections, marked **Recommendation** or **Known inconsistency**, so they are never mistaken for current behaviour.

For build, deployment and writing articles, see the repository [README](../README.md). This folder covers design only.

## Reading order

| Document | Read it to learn… |
| --- | --- |
| [design-overview.md](design-overview.md) | Why the site looks the way it does: goals, audience, principles. Start here. |
| [visual-system.md](visual-system.md) | The values: fonts, type scale, spacing, colors, borders, and how each content type is styled. |
| [layout-and-pages.md](layout-and-pages.md) | Page structure, container and content widths, and how they relate. Per-page specifications. |
| [components.md](components.md) | Every reusable component: purpose, markup, styling hooks, and rules for keeping them consistent. |
| [responsive-and-accessibility.md](responsive-and-accessibility.md) | Breakpoints, behaviour per screen size, and accessibility practice and gaps. |
| [maintenance.md](maintenance.md) | Where each design decision lives in the source, a change checklist, and the list of known inconsistencies. |

Each fact lives in one document and the others link to it. Numeric values (sizes, widths, colors) are defined in [visual-system.md](visual-system.md) and [layout-and-pages.md](layout-and-pages.md) only.

## Source of truth

The code is authoritative. If a value here disagrees with `src/styles/global.css`, the stylesheet is right and the document is stale. Fix the document in the same change that edits the CSS (see [maintenance.md](maintenance.md)).

*Last reviewed against the implementation: 2026-10-20.*
