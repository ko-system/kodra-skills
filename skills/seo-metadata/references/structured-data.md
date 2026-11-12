# Structured data (JSON-LD)

JSON-LD tells search engines what a page is about (a business, a product, an
article). Rules:

- Mark up only content that is visible on the page. Never invent ratings,
  reviews, prices or opening hours.
- One `<script type="application/ld+json">` per entity type is fine.
- Use absolute URLs. Keep values in sync with the page by building the object
  from the same data the page renders.
- Escape `<` in serialized JSON so content can't close the script tag:
  `JSON.stringify(data).replace(/</g, "\\u003c")`.

## Rendering

<vite-nitro-only>
In a Vite SPA, render the script inside the page component (React 19 keeps it
in place; Google executes JavaScript). Site-wide entities (Organization,
WebSite) can also go statically in `index.html` so non-JS crawlers see them.

```tsx
// src/components/JsonLd.tsx
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}
```

</vite-nitro-only>

<nextjs-only>
In Next.js, render the script from the Server Component page so it is in
the initial HTML:

```tsx
// app/products/[slug]/page.tsx (excerpt)
export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const product = await getProduct((await params).slug);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name /* ... */,
  };
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />
      {/* page content */}
    </>
  );
}
```

</nextjs-only>

## Organization and WebSite (home page)

```json
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "Baan Saan Cooking School",
  "url": "https://baansaan.example/",
  "logo": "https://baansaan.example/logo.png",
  "sameAs": ["https://www.facebook.com/baansaan"]
}
```

## LocalBusiness (shops, clinics, restaurants)

Use the most specific subtype: `Restaurant`, `Dentist`, `BeautySalon`,
`HealthClub`, `Store`.

```json
{
  "@context": "https://schema.org",
  "@type": "Restaurant",
  "name": "Krua Baan Saan",
  "image": "https://baansaan.example/storefront.jpg",
  "url": "https://baansaan.example/",
  "telephone": "+66-53-000-000",
  "priceRange": "฿฿",
  "servesCuisine": "Thai",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "12 Ratchadamnoen Rd",
    "addressLocality": "Chiang Mai",
    "postalCode": "50200",
    "addressCountry": "TH"
  },
  "openingHoursSpecification": [
    {
      "@type": "OpeningHoursSpecification",
      "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
      "opens": "10:00",
      "closes": "21:00"
    }
  ]
}
```

## Product

```json
{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "Handmade celadon bowl",
  "image": ["https://shop.example/images/bowl-1200.jpg"],
  "description": "Hand-thrown celadon bowl, 15 cm, dishwasher safe.",
  "sku": "BOWL-15-GRN",
  "brand": { "@type": "Brand", "name": "Doi Ceramics" },
  "offers": {
    "@type": "Offer",
    "url": "https://shop.example/products/celadon-bowl",
    "priceCurrency": "THB",
    "price": "590.00",
    "availability": "https://schema.org/InStock"
  }
}
```

Add `aggregateRating` only when real reviews are displayed on the page.

## Article / BlogPosting

```json
{
  "@context": "https://schema.org",
  "@type": "BlogPosting",
  "headline": "How to make green curry paste from scratch",
  "image": ["https://baansaan.example/blog/green-curry.jpg"],
  "datePublished": "2026-03-02T08:00:00+07:00",
  "dateModified": "2026-03-10T09:30:00+07:00",
  "author": { "@type": "Person", "name": "Saan Wongsa" }
}
```

## FAQPage

Only for a page whose main content is the FAQ list shown to users.

```json
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "Do you offer vegetarian classes?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Yes. Every dish can be made vegetarian; tell us when you book."
      }
    }
  ]
}
```

## BreadcrumbList

```json
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    {
      "@type": "ListItem",
      "position": 1,
      "name": "Classes",
      "item": "https://baansaan.example/classes"
    },
    {
      "@type": "ListItem",
      "position": 2,
      "name": "Green curry",
      "item": "https://baansaan.example/classes/green-curry"
    }
  ]
}
```

## Validate

Paste the rendered page HTML into a structured data validator (Google Rich
Results Test or the Schema.org validator) when the owner has internet access;
fix errors before warnings.
