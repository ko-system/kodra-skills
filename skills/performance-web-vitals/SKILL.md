---
slug: performance-web-vitals
name: Performance and Web Vitals
version: 1.0.0
description: Improve LCP, CLS and INP in React apps through image sizing and formats, lazy loading, route code splitting, font loading, bundle trimming and render performance.
when_to_use: When pages load slowly, jump while loading or feel laggy on taps, before launch of a public site, when adding large images, video or heavy libraries, or when the owner reports a poor PageSpeed score.
tags: [performance, web-vitals, images, bundle, fonts]
roles: [performance-engineer, frontend-developer]
license: MIT
references:
  - file: references/checklist.md
    description: Detailed fixes per metric, image pipeline commands, bundle analysis, React render optimizations and Next.js specifics.
scripts:
  - name: find_large_assets
    file: scripts/find_large_assets.js
    description: Uses file_stats to list oversized images, videos and fonts, and flags images without dimensions, eager below-the-fold images, heavy imports and non-lazy routes.
    writes: false
---

# Performance and Web Vitals

Targets (75th percentile of real users, mobile):

| Metric | Measures                | Good      | Usual culprits                                                   |
| ------ | ----------------------- | --------- | ---------------------------------------------------------------- |
| LCP    | Main content visible    | <= 2.5 s  | Huge hero image, render-blocking fonts/CSS, big JS before render |
| CLS    | Layout stability        | <= 0.1    | Images without size, late fonts, injected banners                |
| INP    | Response to taps/clicks | <= 200 ms | Long JS tasks, re-rendering big lists, heavy handlers            |

Measure first (Lighthouse in the browser devtools, mobile preset, or the
`performance` panel), fix the biggest item, measure again.

## 1. Images (largest win in most apps)

- **Right size:** never ship a 4000px photo into a 600px slot. Export at
  about 2x the displayed CSS width (hero: 1600-2000px wide; cards: 600-800px).
- **Right format:** WebP or AVIF for photos (60-80% smaller than JPEG/PNG),
  SVG for icons and logos, PNG only for screenshots that need it.
- **Budget:** hero <= 200 KB, other images <= 100 KB, total page images
  <= 1 MB on first load.
- **Always set dimensions:** `width`/`height` attributes (or an `aspect-*`
  class) so the browser reserves space (CLS).
- **Lazy-load below the fold:** `loading="lazy" decoding="async"`. Never lazy
  the LCP image; give it `fetchPriority="high"`.
- **Responsive sources:** `srcSet` + `sizes` for large images.

```tsx
<img
  src="/images/menu-800.webp"
  srcSet="/images/menu-400.webp 400w, /images/menu-800.webp 800w, /images/menu-1600.webp 1600w"
  sizes="(min-width: 1024px) 50vw, 100vw"
  width={800}
  height={600}
  loading="lazy"
  decoding="async"
  alt="Lunch set with green curry and jasmine rice"
  className="h-auto w-full rounded-xl object-cover"
/>
```

In Next.js use `next/image` (`priority` on the LCP image, `sizes` on
responsive images); it handles formats and sizes. Configure
`images.remotePatterns` for remote sources.

- Replace animated GIFs with muted looping `<video autoPlay muted loop playsInline>` (MP4/WebM).
- Video: `preload="none"` or `"metadata"` and a `poster` image; don't autoplay
  large videos on mobile data.

## 2. JavaScript

- **Route code splitting:** the KODRA scaffold already uses
  `lazy(() => import("./pages/X"))` in `src/App.tsx`. Keep every new page
  lazy. Next.js splits by route automatically.
- **Lazy heavy widgets:** charts, maps, rich text editors, PDF viewers,
  date-heavy calendars: `const Chart = lazy(() => import("@/components/RevenueChart"))`
  inside `<Suspense fallback={<Skeleton className="h-64" />}>`.
- **Trim imports:** named imports from `lucide-react` (never `import *`),
  `date-fns` functions (not moment), `lodash-es/debounce` (not all of lodash).
  Don't add a library for something `Intl` or a 10-line helper does.
- **Third-party scripts** (chat widgets, analytics, pixels): load after
  interaction or idle, with `async`/`defer`; each one costs main-thread time.

## 3. Fonts

- At most 2 families and only the weights used (e.g. 400/600). Thai fonts
  are larger; subset or limit weights.
- Google Fonts: keep `preconnect` to `fonts.googleapis.com` and
  `fonts.gstatic.com` (`crossorigin`) and `&display=swap` in the CSS URL.
- Self-hosted (`@fontsource/*` or files in `public/`): WOFF2 only,
  `font-display: swap`, preload the main text font:
  `<link rel="preload" href="/fonts/plex-thai-400.woff2" as="font" type="font/woff2" crossorigin>`.
- Next.js: `next/font/google` (self-hosts, no layout shift).

## 4. Layout stability (CLS)

- Dimensions on images, iframes, videos and ad/embed slots.
- Skeletons the same size as the loaded content.
- Don't insert banners above existing content after load; reserve space or
  overlay them.
- Animate with `transform`/`opacity`, not `top`/`height`.

## 5. Responsiveness (INP)

- Keep event handlers light; move heavy work off the click path
  (`startTransition` for non-urgent state updates, `useDeferredValue` for
  filtering big lists as the user types).
- Virtualize lists over ~200 rows (`@tanstack/react-virtual`) or paginate.
- Avoid re-rendering the whole page on each keystroke: keep input state local,
  memoize expensive derived data (`useMemo`) and row components (`memo`) when
  profiling shows it matters.
- Debounce search requests (300 ms) and cancel stale ones (TanStack Query
  does this when the key changes).

## 6. Network and caching

- Serve compressed assets (the hosting/publish step usually does; check
  `content-encoding: br/gzip`).
- Hashed asset file names (Vite and Next.js do this) can be cached for a year;
  HTML should not be cached long.
- Reduce request waterfalls: fetch page data in parallel, prefetch on hover
  for likely next routes, and avoid chained `useEffect` fetches.
- API responses: return only needed fields; paginate lists.

## Workflow

1. Run `find_large_assets`; fix `error` findings (oversized images/video, GIFs).
2. Check the LCP element on the main pages (devtools Performance panel) and
   make sure it is not lazy and is small.
3. Check route and widget code splitting; run a production build and look at
   the largest chunks (see `references/checklist.md`).
4. Re-measure on the mobile preset and record before/after numbers.

## Script

`find_large_assets` args (optional): `{ "dirs": ["public", "src"],
"imageKb": 200, "videoKb": 2048, "fontKb": 150, "maxFindings": 120 }`. It
walks the directories, calls `file_stats` for each asset, and scans source
files. Returns `totals` by asset type, `largest` files, and `findings` with
rules `large-image`, `large-gif`, `large-video`, `large-font`, `legacy-font`,
`large-svg`, `img-no-dimensions`, `lazy-candidate`, `heavy-import` and
`eager-route`.
