---
slug: responsive-layout
name: Responsive layout
version: 1.1.0
description: Mobile-first layouts with Tailwind breakpoints, fluid type, 44px touch targets, safe areas and container queries, so pages work from 320px phones to wide desktops.
when_to_use: When building any new page or component, when a layout breaks or scrolls sideways on mobile, or before shipping a page that was designed only at desktop width.
tags: [ui, responsive, mobile, tailwind, layout]
roles: [ui-designer, frontend-developer, qa-tester]
license: MIT
references:
  - file: references/patterns.md
    description: Ready-made responsive patterns (nav, sidebar shell, card grids, tables, forms, media) and a device test matrix.
scripts:
  - name: find_fixed_widths
    file: scripts/find_fixed_widths.js
    description: Finds fixed pixel widths, non-collapsing grids, small touch targets and 100vh usage that break small screens.
    writes: false
---

# Responsive layout

Design for the smallest screen first, then add space and columns as the
viewport grows. Tailwind breakpoints are min-width: unprefixed classes apply to
phones, `sm:` from 640px, `md:` 768px, `lg:` 1024px, `xl:` 1280px, `2xl:` 1536px.

## Core rules

1. **No horizontal scroll at 320px.** Nothing may be wider than the viewport:
   no fixed `w-[600px]`, no unwrapped long strings, no tables without an
   `overflow-x-auto` wrapper.
2. **Unprefixed = mobile.** Write `grid-cols-1 md:grid-cols-3`, never a bare
   `grid-cols-3` for content grids.
3. **Constrain, don't fix.** Prefer `w-full max-w-md` over `w-[448px]`;
   `max-w-prose` for text. The page container width comes from the app's
   design tokens, not a fixed `max-w-7xl` (see Page containers below).
4. **Touch targets >= 44x44px** for anything tappable on mobile (`h-11`,
   `min-h-11 min-w-11`, or padding). shadcn `size="icon"` is 40px; use
   `className="h-11 w-11"` for primary mobile icon buttons.
5. **Fluid, readable type.** Body 16px minimum (`text-base`); inputs at least
   16px so iOS does not zoom on focus. Scale headings by breakpoint
   (`text-3xl sm:text-4xl lg:text-5xl`) or with `clamp()`.
6. **Use dynamic viewport units.** `min-h-dvh` / `h-dvh` instead of
   `h-screen` for full-height layouts, because mobile browser bars change the
   viewport height.
7. **Respect safe areas** on notched phones for fixed bars:
   `pb-[env(safe-area-inset-bottom)]` and `viewport-fit=cover` in the viewport
   meta when you use them.

## Layout toolkit

| Need                           | Pattern                                                                         |
| ------------------------------ | ------------------------------------------------------------------------------- |
| Page container                 | `mx-auto w-full max-w-container px-gutter` (token-based; see below)             |
| Stack -> row                   | `flex flex-col gap-4 md:flex-row md:items-center`                               |
| Card grid                      | `grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3`                          |
| Auto-fit grid (no breakpoints) | `grid gap-6 [grid-template-columns:repeat(auto-fit,minmax(16rem,1fr))]`         |
| Sidebar + content              | `grid lg:grid-cols-[16rem_1fr]`; sidebar becomes a `Sheet` below `lg`           |
| Two-pane split                 | `grid gap-10 md:grid-cols-2 items-center`                                       |
| Media                          | `aspect-video w-full object-cover` (or `aspect-[4/3]`), with width/height attrs |
| Long words / URLs              | `break-words` (`overflow-wrap:anywhere` via `[overflow-wrap:anywhere]`)         |
| Wide tables                    | wrapper `overflow-x-auto`, or switch to stacked cards below `md`                |
| Hide/show                      | `hidden md:block` / `md:hidden`; never duplicate large content trees            |

## Page containers

The container width is part of the app's design direction, so it lives in the
tokens: `--container-max` in the `kodra:design-tokens` block of the global
stylesheet, exposed as `max-w-container`, `max-w-container-narrow` (reading
columns) and `max-w-container-wide`. The horizontal gutter is `px-gutter` and
section rhythm is `py-section` / `py-section-tight` / `py-section-airy`; all
scale with `--density`. Use the scaffold's `Section` block (`width`:
narrow, default, wide, full) instead of repeating container classes.

Typical `--container-max` by archetype: editorial 64-72rem (with a narrow
reading column), luxury-minimal and organic-craft about 72rem, tech-dark and
corporate-trust about 80rem, swiss-grid 80-96rem, data-dense-pro full width.
In an older app without these utilities, pick one width for the app from that
range (for example `max-w-6xl`) and reuse it everywhere; never mix container
widths at random.

Flex children that contain text need `min-w-0` so `truncate` works and they can
shrink: `<div className="min-w-0 flex-1"><p className="truncate">...</p></div>`.

## Fluid typography

```css
/* src/globals.css (Vite) or app/globals.css (Next.js) */
@layer base {
  h1 {
    font-size: clamp(2rem, 1.4rem + 3vw, 3.5rem);
    line-height: 1.15;
  }
  h2 {
    font-size: clamp(1.5rem, 1.2rem + 1.5vw, 2.25rem);
    line-height: 1.2;
  }
}
```

In apps with the KODRA design preset, size text with the modular scale
(`text-step-0` … `text-step-6`, `text-display`), which follows the direction's
`--type-scale`; add responsive steps (`text-step-3 md:text-step-5`) instead of
fixed pixel sizes. Otherwise use breakpoint classes when you only need two or
three sizes, and `clamp()` when a heading must scale smoothly. Thai text needs looser line-height (1.35
headings, 1.7 body); see the thai-localization skill.

## Container queries

Use them when a component's layout should depend on its own width (cards in a
sidebar vs main column), not the viewport. Tailwind 3.4 needs the
`@tailwindcss/container-queries` plugin (check `tailwind.config.ts`; add it to
`plugins` if missing); Tailwind 4 has them built in.

```tsx
<div className="@container">
  <article className="flex flex-col gap-3 @md:flex-row @md:items-center">
    <img className="aspect-video w-full rounded-lg object-cover @md:w-48" ... />
    <div className="min-w-0">...</div>
  </article>
</div>
```

## Navigation

- Below `md`: brand + menu button that opens a `Sheet` (shadcn) with the
  links; the button has `aria-label` and `aria-expanded`. `SiteHeader` in the
  scaffold already does this.
- At `md` and up: inline links. Keep at most 5-6 top-level items.
- Sticky headers: `sticky top-0 z-40` with a background that matches the
  direction (solid, or translucent with `backdrop-blur` when the direction uses
  glass); add `scroll-mt-20` to anchor targets.

## Responsive images

- Always set `width` and `height` (or an `aspect-*` class) to avoid layout shift.
- Serve sizes that match the slot: in Vite, use `srcSet`/`sizes` with
  pre-sized files in `public/`; in Next.js use `next/image` with `sizes`
  (e.g. `sizes="(min-width: 1024px) 50vw, 100vw"`).
- `object-cover` for photos in fixed-ratio frames; `object-contain` for logos.

## Motion and input

- Hover-only interactions must also work on tap and keyboard. Use
  `hover:` for decoration only, never to reveal required actions, and limit
  hover effects to real pointers: `@media (hover: hover)` (Tailwind 3.4:
  `future: { hoverOnlyWhenSupported: true }`; Tailwind 4 does this by default).
- Use `motion-safe:` / `motion-reduce:` for animations.
- Use `inputMode` and `autoComplete` on inputs (`inputMode="numeric"`,
  `autoComplete="tel"`) so phones show the right keyboard.

## Verify

1. Run `find_fixed_widths` and fix `error` findings.
2. Screenshot at 390px, 768px, 1024px and 1440px (preview_screenshot when
   available). Look for horizontal scrolling, overlapping text, clipped
   buttons, and tap targets that are too close together (keep >= 8px apart).
3. Zoom to 200% at desktop width: content must reflow without loss (WCAG 1.4.10).

## Script

`find_fixed_widths` args (optional): `{ "dir": "src", "maxFindings": 120,
"minWidthPx": 400 }`. It scans `.tsx/.jsx/.ts/.css/.html` files (skipping
`src/components/ui/`) and returns `findings` with `file`, `line`, `rule`,
`severity` and a suggestion. Rules: `fixed-width`, `inline-fixed-width`,
`css-fixed-width`, `grid-no-mobile`, `small-touch-target`, `viewport-height`.
Findings are heuristics; read the code before changing it.
