---
slug: landing-page
name: Landing page
version: 1.1.0
description: Build conversion-focused marketing pages with a narrative chosen for the business and design direction, a clear hero and primary CTA, and only the sections real content supports.
when_to_use: When creating or redesigning a home page, product page, launch page or any marketing page whose job is to get a visitor to sign up, buy, book or contact.
tags: [ui, marketing, landing, copywriting, conversion]
roles: [ui-designer, frontend-developer, copywriter]
license: MIT
references:
  - file: references/section-patterns.md
    description: JSX patterns for each section built from the scaffold blocks and their variants, plus layout variations.
  - file: references/copy-formulas.md
    description: Headline, subhead, CTA and FAQ copy formulas with good and bad examples.
scripts:
  - name: audit_landing_sections
    file: scripts/audit_landing_sections.js
    description: Checks a landing page for exactly one h1 and a primary call to action in the hero, reports which other sections exist, and flags placeholder copy.
    writes: false
---

# Landing page

A landing page has one job: move a specific visitor to one action. Every
section either builds the case for that action or removes a reason not to take
it. Decide the action first, then design.

## 1. Decide before you build

Write these down (in DESIGN.md if the app has one) before touching JSX:

- **Audience:** who arrives here, and what they already know.
- **Primary action:** one verb ("Start free trial", "Book a table", "Get a quote").
  Every page has exactly one primary CTA label; repeat it, don't vary it.
- **Secondary action:** optional and lower-commitment ("See pricing", "Watch demo").
- **Proof you actually have:** real numbers, customer names, quotes, ratings.
  Never invent testimonials, logos, user counts or prices. If the owner has not
  supplied them, leave the section out or use a clearly marked TODO in the
  content data, not in visible copy.

## 2. Pick a narrative, not a fixed order

There is no single section order. Choose the narrative from the business, the
primary action and the app's design direction (archetype), then pick block
variants that fit it. Every narrative needs a hero (or page header) with the
primary CTA; everything else is optional and appears only with real content.

| Narrative          | Fits                                       | Typical flow                                                                                           |
| ------------------ | ------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| Story-led          | Restaurants, makers, studios, nonprofits   | Statement hero → origin or process with real photos → the offer (menu, services) → proof → visit/contact |
| Product tour       | Apps, SaaS, devices                        | Split hero with the product → 3-4 feature chapters (alternating) → how it works → pricing → FAQ → CTA   |
| Editorial          | Portfolios, consultants, events, writing   | Editorial hero → narrow reading column with pull quotes and full-bleed images → selected work → contact |
| Catalog-first      | Shops, listings, menus, rentals            | Compact hero → filter + item grid near the top → categories → delivery/booking details → trust          |
| Single-screen      | Booking, quotes, calculators, sign-ups     | The form or tool is the hero; short supporting panels beside or below                                   |
| Proof-led          | Clinics, trades, B2B services              | Split hero → hard numbers (`StatShowcase`) → services → case or before/after → testimonials → CTA      |

Block variants to reach for (see the design-patterns guide for the archetype
mapping): `Hero` split, centered, full-bleed-media, editorial, collage or
minimal-statement; `Section` width, spacing and tone; `FeatureGrid` cards,
list, icon-row, numbered or alternating; `CtaBand` band, card, inline or split;
`StatShowcase`, `ImageMosaic`, `Marquee`, `SectionDivider`. Two landing
pages for different businesses should not share the same sequence of blocks.

Every page also gets at least one bespoke section built from scratch for this
business (a menu board, a service-area map, a before/after, a price
calculator, a history timeline) and one signature moment from the direction.

Drop sections that have no real content. A short honest page beats a long
padded one.

## 3. Hero rules

- **Exactly one `<h1>`** on the page, inside the hero. `Hero` already renders
  its `title` as the h1; don't add another h1 elsewhere. Section titles are h2.
- Headline states the outcome for the audience in under ~10 words. The subhead
  (one or two sentences, under ~25 words) says how, for whom, or what makes it different.
- Primary CTA visible without scrolling at 375x667 and 1280x800. Put it in the
  `actions` prop of `Hero`; link to the real destination (route, `mailto:`,
  `tel:`, form anchor), never `href="#"`.
- Pick the `Hero` variant from the narrative and direction, not by habit.
- Media: a real product screenshot, photo or illustration that shows the
  outcome. Set explicit `width`/`height` on the image and don't lazy-load the
  hero image (it is usually the LCP element).
- Optional trust line under the CTA: "No credit card required", "4.8/5 from 1,200 reviews".

## 4. Copy hierarchy

1. Headline (h1): outcome. 2. Subhead: mechanism or audience. 3. CTA: verb + object.
2. Section titles (h2): benefit statements, not labels ("Close the books in a day", not "Features").
3. Body: short paragraphs, under ~80 characters per line (`max-w-prose` or `max-w-xl`).

Write specific, plain copy in the app's language. No lorem ipsum, no
"Revolutionize your workflow", no "Feature 1". See `references/copy-formulas.md`.

## 5. Layout and visual rhythm

- Use semantic tokens (`bg-background`, `bg-secondary`, `text-muted-foreground`),
  never raw palette classes. Change `Section` `width`, `spacing` and `tone`
  between sections (a narrow airy story, a full-width inverted band, a tight
  muted list) instead of adding borders and shadows everywhere.
- Vary section shapes: a grid, then a split image/text, then a full-width quote.
  Avoid a page that is only stacked identical card grids.
- Space within a group (heading and its text, a card's parts) is smaller than
  space between groups; not every section is equally loud.
- One bold element per page (the hero visual or a type treatment). Keep the rest calm.
- Wrap content groups in `<Reveal>` with staggered `delay={index * 80}`;
  `BentoGrid`, `Testimonials`, `PricingTable`, `StatShowcase` and
  `ImageMosaic` already reveal themselves.
- Mobile first: single column below `md`, CTA buttons full width on phones
  (`w-full sm:w-auto`), tap targets at least 44px.

## 6. Conversion details

- Repeat the primary CTA where the decision happens (after the offer or
  pricing) and at the end of the page.
- Anchor navigation: give sections `id`s (`<Section id="pricing">`) and link to
  `#pricing`; add `scroll-mt-20` so the sticky header does not cover headings.
- Forms on the page: ask for the minimum (email, or name + phone). Show inline
  validation and a clear success state (see the forms-validation skill).
- Pricing: show the currency and billing period, highlight one plan, and state
  what happens after clicking (trial length, cancellation).
- Accessibility: visible focus, alt text on meaningful images, contrast 4.5:1,
  buttons that say what they do.

## 7. Done checklist

- [ ] The narrative fits the business; block variants follow the direction.
- [ ] At least one bespoke section and one signature moment.
- [ ] One h1, in the hero; section titles are h2 in order.
- [ ] Primary CTA above the fold on mobile and desktop, pointing at a real target.
- [ ] Every claim, number, logo and quote is real or the section is removed.
- [ ] Hero image has width/height and is not lazy; other images are lazy.
- [ ] Page title and meta description set (see the seo-metadata skill).
- [ ] Checked at 375px, 768px and 1280px widths with a screenshot.
- [ ] Ran `audit_landing_sections` and fixed failures.

## Script

`audit_landing_sections` reads the page file and the local components it
imports. Args (all optional): `{ "file": "src/pages/Index.tsx" }`. Without
`file` it tries `src/pages/Index.tsx`, `app/page.tsx`, `src/app/page.tsx`,
`pages/index.tsx` and `src/pages/index.tsx`. It returns `checks` (pass, warn or
fail), detected `sections`, `missingOptional` (reported only; leave them out
when the narrative or real content does not call for them) and
`placeholders`. Only a missing hero, h1 or hero CTA fails. It is heuristic:
confirm failures by reading the code before changing anything.
