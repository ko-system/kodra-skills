# Performance checklist and recipes

## LCP (Largest Contentful Paint)

1. Identify the LCP element (usually the hero image or h1) in the devtools
   Performance panel ("LCP" marker).
2. If it is an image:
   - Under 200 KB, WebP/AVIF, sized for the slot.
   - Not lazy; `fetchPriority="high"`; in Next.js `priority`.
   - Discoverable in HTML: avoid setting it as a CSS background that loads
     late, and avoid rendering it only after a data fetch.
   - Optional preload in `index.html` for a static hero:
     `<link rel="preload" as="image" href="/images/hero-1600.webp" imagesrcset="..." imagesizes="100vw">`.
3. If it is text: fonts with `display=swap`; nothing blocking render.
4. Reduce JavaScript needed before first render: lazy routes and widgets,
   no large synchronous imports in `main.tsx`.
5. Server/API latency: the page should render its shell immediately; data
   regions show skeletons.

## CLS (Cumulative Layout Shift)

- [ ] Every `<img>`, `<video>`, `<iframe>` has width/height or an aspect class.
- [ ] Skeletons match final content size.
- [ ] Web fonts: `display=swap` plus a fallback with similar metrics; Next.js
      `next/font` handles this.
- [ ] Cookie banners and toasts overlay content instead of pushing it.
- [ ] No content inserted above the viewport after load (e.g. "New items" bars
      push content; show them as overlays).

## INP (Interaction to Next Paint)

- [ ] No click handler does more than ~50 ms of synchronous work.
- [ ] Large lists are paginated or virtualized.
- [ ] Filtering big arrays uses `useDeferredValue` / `startTransition`.
- [ ] Expensive components memoized only where profiling shows re-renders.
- [ ] Context values are stable (memoized) so all consumers don't re-render.
- [ ] Third-party scripts are deferred.

```tsx
const [query, setQuery] = useState("");
const deferredQuery = useDeferredValue(query);
const results = useMemo(
  () => filterProducts(products, deferredQuery),
  [products, deferredQuery],
);
```

## Image pipeline

When the owner provides large photos, convert and resize before adding them
to `public/`. If the environment has no image tools, ask the owner to export
WebP at the target widths, or use an image CDN/Supabase Storage
transformations if the app already uses one.

Target widths per use:

| Use              | Widths to export      | Max size (WebP) |
| ---------------- | --------------------- | --------------- |
| Full-width hero  | 800, 1200, 1600, 2000 | 200 KB at 1600  |
| Half-width image | 600, 900, 1200        | 120 KB at 900   |
| Card thumbnail   | 400, 800              | 60 KB at 800    |
| Avatar / logo    | 96, 192 (or SVG)      | 15 KB           |
| OG share image   | 1200x630 JPEG/PNG     | 300 KB          |

## Bundle analysis

- Vite: run a production build and read the chunk size table it prints;
  chunks over ~200 KB gzip deserve a look. Optional: `rollup-plugin-visualizer`
  as a dev dependency to see what's inside.
- Next.js: `next build` prints per-route First Load JS; keep shared JS under
  ~150 KB gzip. Mark heavy client-only components with
  `dynamic(() => import(...), { ssr: false })` where appropriate.

Common heavy dependencies and lighter alternatives:

| Heavy                         | Lighter                                 |
| ----------------------------- | --------------------------------------- |
| moment                        | `Intl.DateTimeFormat`, date-fns         |
| lodash (full)                 | native methods, `lodash-es/<fn>`        |
| chart library on every page   | lazy-load the chart component           |
| full icon packs (`import *`)  | named `lucide-react` imports            |
| animation libraries for fades | Tailwind `animate-in` / CSS transitions |
| axios                         | `fetch` with a small wrapper            |

## React rendering

- Keys: stable IDs, never array indexes for dynamic lists.
- Don't create new objects/functions in props of memoized children without
  `useMemo`/`useCallback` (only matters if the child is memoized).
- Split big pages into components so state changes re-render small subtrees.
- Use TanStack Query `select` to subscribe components to only the slice they need.

## Next.js specifics

- Prefer Server Components for static and data-display parts; mark only
  interactive leaves `"use client"`.
- Use `next/image`, `next/font`, `next/script` (`strategy="lazyOnload"` for
  third parties).
- Cache data fetches appropriately (`revalidate`) for pages that don't need
  per-request data.
- Stream slow sections with `<Suspense>` and `loading.tsx`.

## Reporting

Report before/after for each change: metric, page, device preset, value.
Example: "Home LCP 4.1 s -> 2.2 s (mobile preset): hero 1.8 MB JPEG replaced
with 170 KB WebP, removed lazy loading from hero."
