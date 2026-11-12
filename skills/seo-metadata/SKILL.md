---
slug: seo-metadata
name: SEO metadata
version: 1.0.0
description: Page titles, meta descriptions, Open Graph and Twitter cards, canonical URLs, sitemap, robots and JSON-LD structured data for Vite SPAs and Next.js App Router apps.
when_to_use: When a site will be published or shared, when adding public pages, when link previews look wrong, or when the owner asks about Google ranking or search visibility.
tags: [seo, metadata, open-graph, sitemap, json-ld]
roles: [frontend-developer, seo-specialist, copywriter]
framework_sections: true
license: MIT
references:
  - file: references/structured-data.md
    description: JSON-LD templates (Organization, LocalBusiness, Product, Article, FAQPage, BreadcrumbList) and how to render them.
scripts:
  - name: check_meta
    file: scripts/check_meta.js
    description: Checks the title, description, viewport, lang, Open Graph and Twitter tags, canonical, favicon, robots and sitemap for the detected framework.
    writes: false
---

# SEO metadata

Search engines and link previews read a small set of tags. Get these right on
every public page; they matter more than anything else you can do in code.

## What every public page needs

| Item             | Rule                                                                                                                               |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `<title>`        | Unique per page, 30-60 chars, primary topic first, brand last: "Thai cooking classes in Chiang Mai - Baan Saan"                    |
| Meta description | 70-160 chars, specific, written for humans; becomes the search snippet                                                             |
| `<html lang>`    | Content language (`en`, `th`)                                                                                                      |
| Viewport         | `width=device-width, initial-scale=1`                                                                                              |
| Canonical        | Absolute URL of the preferred version of the page                                                                                  |
| Open Graph       | `og:title`, `og:description`, `og:image` (absolute, 1200x630), `og:url`, `og:type`, `og:site_name`, `og:locale` (`th_TH`, `en_US`) |
| Twitter card     | `twitter:card=summary_large_image` (falls back to OG for the rest)                                                                 |
| One `h1`         | Matches the page's topic; headings in a logical order                                                                              |
| Favicon          | `/favicon.ico` or SVG + `apple-touch-icon` (180x180)                                                                               |
| robots / sitemap | `robots.txt` allowing crawl and pointing at `sitemap.xml`                                                                          |

Private pages (dashboards, account, checkout steps) get
`<meta name="robots" content="noindex">` and are left out of the sitemap.

You need the site's public origin (for canonical, `og:url`, sitemap). Use
the custom domain if the owner has one; otherwise ask, and keep it in one
constant (`SITE_URL`) so it is changed in one place.

<vite-nitro-only>
## Vite (React SPA)

Static defaults go in `index.html`; per-route values are set at runtime.
Crawlers that run JavaScript (Google) see runtime titles; most link-preview
bots (chat apps, social networks) only read the static `index.html`. So make
`index.html` describe the site well, and set per-page titles in React.

```html
<!-- index.html -->
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Baan Saan Cooking School - Thai cooking classes in Chiang Mai</title>
    <meta
      name="description"
      content="Half-day Thai cooking classes with a market tour, small groups and hotel pickup in Chiang Mai. Book online from ฿1,200."
    />
    <link rel="canonical" href="https://baansaan.example/" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Baan Saan Cooking School" />
    <meta property="og:title" content="Thai cooking classes in Chiang Mai" />
    <meta
      property="og:description"
      content="Market tour, small groups, hotel pickup. Book online from ฿1,200."
    />
    <meta property="og:image" content="https://baansaan.example/og-image.jpg" />
    <meta property="og:url" content="https://baansaan.example/" />
    <meta name="twitter:card" content="summary_large_image" />
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
    <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
  </head>
</html>
```

Replace the scaffold's default `<title>` immediately. Per-route metadata with a
small hook (no extra dependency; React 19 can also render `<title>` and
`<meta>` inside components and hoists them to `<head>`):

```tsx
// src/hooks/use-page-meta.ts
import { useEffect } from "react";

const SITE_NAME = "Baan Saan Cooking School";

export function usePageMeta({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  useEffect(() => {
    document.title = `${title} - ${SITE_NAME}`;
    if (description) {
      let tag = document.querySelector<HTMLMetaElement>(
        'meta[name="description"]',
      );
      if (!tag) {
        tag = document.createElement("meta");
        tag.name = "description";
        document.head.appendChild(tag);
      }
      tag.content = description;
    }
  }, [title, description]);
}
```

Call it at the top of every page component. Put `robots.txt`, `sitemap.xml`,
`og-image.jpg` and favicons in `public/`. Write the sitemap by hand for a
handful of routes (list each public route from `src/App.tsx`); for
data-driven pages generate it from a Nitro route (`server/routes/sitemap.xml.ts`)
if the app has a server layer.
</vite-nitro-only>

<nextjs-only>
## Next.js (App Router)

Use the Metadata API; never hand-write `<head>` tags in App Router pages.
`metadata` only works in Server Components, so keep `"use client"` out of
`page.tsx`/`layout.tsx` files that export it (move interactive parts into child
components).

```tsx
// app/layout.tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  metadataBase: new URL("https://baansaan.example"),
  title: { default: "Baan Saan Cooking School", template: "%s - Baan Saan" },
  description:
    "Half-day Thai cooking classes with a market tour, small groups and hotel pickup in Chiang Mai.",
  openGraph: {
    type: "website",
    siteName: "Baan Saan Cooking School",
    locale: "en_US",
    images: ["/og-image.jpg"],
  },
  twitter: { card: "summary_large_image" },
  alternates: { canonical: "/" },
};
```

```tsx
// app/classes/[slug]/page.tsx
import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const item = await getClass(slug);
  if (!item) return { title: "Class not found", robots: { index: false } };
  return {
    title: item.title,
    description: item.summary,
    alternates: { canonical: `/classes/${slug}` },
    openGraph: {
      title: item.title,
      description: item.summary,
      images: [item.imageUrl],
    },
  };
}
```

```ts
// app/sitemap.ts
import type { MetadataRoute } from "next";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = "https://baansaan.example";
  const classes = await listPublicClasses();
  return [
    { url: `${base}/`, changeFrequency: "weekly", priority: 1 },
    ...classes.map((c) => ({
      url: `${base}/classes/${c.slug}`,
      lastModified: c.updatedAt,
    })),
  ];
}
```

```ts
// app/robots.ts
import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/dashboard", "/api/"] },
    sitemap: "https://baansaan.example/sitemap.xml",
  };
}
```

Use `app/opengraph-image.tsx` (or a static `app/opengraph-image.jpg`) for
share images, and `app/icon.svg` / `app/apple-icon.png` for icons.
</nextjs-only>

## Content and structure

- One topic per page; the URL, title, h1 and description agree.
- Readable URLs: `/classes/green-curry`, lowercase, hyphens, no IDs when a
  slug exists. Keep old URLs working (redirect) when renaming.
- Internal links with descriptive anchor text; every public page reachable
  from navigation or another page.
- Images: descriptive file names and alt text; compressed, sized (see the
  performance-web-vitals skill).
- Structured data (JSON-LD) for businesses, products, articles, FAQs and
  breadcrumbs: see `references/structured-data.md`. Only mark up content that
  is visible on the page.
- Multilingual sites: separate URLs per language (`/th/...`, `/en/...`) with
  `hreflang` alternates; translate titles and descriptions too.

## Done checklist

- [ ] No scaffold default title ("dyad-generated-app", "Vite + React") left.
- [ ] Every public route sets its own title and description.
- [ ] OG image exists at 1200x630, under ~300 KB, absolute URL.
- [ ] Canonical uses the real production origin.
- [ ] `robots.txt` and `sitemap.xml` exist; private routes are `noindex`.
- [ ] `check_meta` reports no `fail`.

## Script

`check_meta` takes no required args (`{ "siteUrl": "https://..." }` optionally
checks that canonical/og:url use that origin). It detects Next.js (a
`next.config.*` or `app/layout.tsx`) or Vite (`index.html`) and returns
`framework`, `checks` (pass, warn, fail) and `pagesWithoutTitle` (Vite
pages that never set a title, or Next.js pages without metadata).
