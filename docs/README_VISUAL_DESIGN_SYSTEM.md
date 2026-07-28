# ResinDB Pro README visual design system

This document is the source of truth for the deterministic diagrams embedded in `README.md`.

## Method

The system follows the workflow and priority order documented by:

- [UI/UX Pro Max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill)
- [UI/UX Pro Max Chinese guide](https://github.com/bbylw/ui-ux-pro-max-skill-cn)

The project was classified as a **scientific materials-informatics analytics dashboard** with a dense enterprise workflow. The resulting design direction is:

- **Style:** Swiss Modernism 2.0 + Bento Grid + Accessible & Ethical + Dimensional Layering;
- **Variance:** balanced (`5/10`);
- **Motion:** minimal (`2/10`); the README diagrams are intentionally static;
- **Density:** dashboard-dense (`8/10`);
- **Stack context:** React + Vite + deterministic Node.js SVG asset restoration.

## Priority order

The diagrams follow the same priority ordering as UI/UX Pro Max:

1. Accessibility;
2. interaction clarity;
3. performance and layout stability;
4. product-appropriate style;
5. responsive structure;
6. typography and semantic color;
7. restrained motion;
8. feedback and state clarity;
9. navigation hierarchy;
10. chart and data legibility.

## Visual tokens

| Token | Value | Purpose |
|---|---|---|
| Canvas | `#F8FAFC` | neutral page background |
| Surface | `#FFFFFF` | cards and panels |
| Alternate surface | `#F1F5F9` | explanatory bands and secondary regions |
| Primary ink | `#0F172A` | headings and high-priority text |
| Body ink | `#334155` | normal explanatory text |
| Muted ink | `#64748B` | supporting labels |
| Border | `#CBD5E1` | visible separators |
| Primary | `#2563EB` | principal system path |
| Teal | `#0F766E` | data and persistence |
| Violet | `#6D28D9` | models and computation |
| Amber | `#B45309` | optional or governed boundaries |
| Rose | `#BE123C` | warnings and risk boundaries |
| Green | `#15803D` | verified or accepted states |

Color is never the only carrier of meaning. Numbered steps, icons, labels and geometry remain visible in monochrome.

## Typography

- Headings: `Inter, Segoe UI, Arial, sans-serif`;
- data labels: `JetBrains Mono, SFMono-Regular, Consolas, monospace`;
- title scale: 32 px;
- card title: 17 px;
- body and support labels: 12–15 px;
- weights use a consistent hierarchy of 500, 650, 720 and 760.

No external font request is required. System fallbacks keep rendering deterministic and offline-safe.

## Layout

- canvas: `1200 × 640`;
- spacing rhythm: 8-point system;
- outer gutter: 64 px;
- card radius: 18 px;
- card border: 1 px;
- shadow: one restrained elevation token;
- diagrams use Bento, flow, grid, hub, split or layered layouts;
- titles, subtitles and metadata occupy a stable 142 px header rail.

## Icon system

All structural icons remain inline SVG paths governed by the same Node.js visual bundle:

- one outline family;
- consistent 2 px stroke;
- rounded caps and joins;
- no emoji icons;
- no external raster assets;
- no mixed filled/outline icon styles within one hierarchy.

## Accessibility contract

Every diagram must contain:

- `role="img"`;
- `aria-labelledby`;
- one `<title>`;
- one `<desc>`;
- one `<metadata>` design-system statement;
- `data-design-system="resindb-uiux-pro-max-v1"`;
- text/background combinations designed for WCAG AA contrast;
- explicit labels so color is not the sole information channel.

## Anti-patterns rejected

The generator deliberately avoids:

- decorative neon glows;
- arbitrary gradients;
- low-contrast gray-on-gray text;
- emoji as icons;
- inconsistent stroke widths;
- random card radii or shadow values;
- color-only status encoding;
- screenshots presented as architecture evidence;
- external image URLs or non-deterministic assets.

## Deterministic regeneration

```bash
npm run visuals:generate
npm run visuals:check
```

`scripts/readme-visuals.bundle.json` is the canonical compressed asset bundle and `scripts/generate-readme-visuals.mjs` owns the complete `docs/images/resindb-*.svg` inventory. A generated file is accepted only when the checked-in version is byte-for-byte identical to a clean Node.js restoration. Intentional SVG edits require `npm run visuals:bundle` before validation.
