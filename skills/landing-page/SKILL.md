---
slug: landing-page
name: Landing page
version: 1.0.0
description: Build conversion-focused marketing pages with a clear hero, social proof, features, pricing, FAQ and a final call to action, using the app's section blocks.
when_to_use: When creating or redesigning a home page, product page, launch page or any marketing page whose job is to get a visitor to sign up, buy, book or contact.
tags: [ui, marketing, landing, copywriting, conversion]
roles: [ui-designer, frontend-developer, copywriter]
license: MIT
references:
  - file: references/section-patterns.md
    description: JSX patterns for each section built from the scaffold blocks, plus layout variations.
  - file: references/copy-formulas.md
    description: Headline, subhead, CTA and FAQ copy formulas with good and bad examples.
scripts:
  - name: audit_landing_sections
    file: scripts/audit_landing_sections.js
    description: Checks a landing page for exactly one h1, a call to action in the hero, missing standard sections and placeholder copy.
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

## 2. Section order (default)

| #   | Section         | Purpose                                    | Block                         |
| --- | --------------- | ------------------------------------------ | ----------------------------- |
| 1   | Header          | Brand, 3-5 nav links, primary CTA          | `SiteHeader`                  |
| 2   | Hero            | Promise + primary CTA above the fold       | `Hero`                        |
| 3   | Proof strip     | Logos, rating or one hard number           | `LogoMarquee` or inline stats |
| 4   | Problem/outcome | Why the status quo hurts, what changes     | `Section` + `SectionHeader`   |
| 5   | Features        | 3-6 benefits, each tied to an outcome      | `FeatureGrid` or `BentoGrid`  |
| 6   | How it works    | 3-4 steps when the process is unfamiliar   | `StepList`                    |
| 7   | Testimonials    | Real quotes with name and role             | `Testimonials`                |
| 8   | Pricing         | Plans, or "from" price and what's included | `PricingTable`                |
| 9   | FAQ             | Objections answered plainly                | `Faq`                         |
| 10  | Final CTA       | Restate promise + same primary CTA         | `CtaBand`                     |
| 11  | Footer          | Contact, legal, secondary links            | `SiteFooter`                  |

Drop sections that have no real content. A short honest page beats a long
padded one. Keep sections 1, 2, 5 and 10 at minimum.

## 3. Hero rules

- **Exactly one `<h1>`** on the page, inside the hero. `Hero` already renders
  its `title` as the h1; don't add another h1 elsewhere. Section titles are h2.
- Headline states the outcome for the audience in under ~10 words. The subhead
  (one or two sentences, under ~25 words) says how, for whom, or what makes it different.
- Primary CTA visible without scrolling at 375x667 and 1280x800. Put it in the
  `actions` prop of `Hero`; link to the real destination (route, `mailto:`,
  `tel:`, form anchor), never `href="#"`.
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
  never raw palette classes. Alternate `Section tone="muted"` to separate blocks
  instead of adding borders and shadows everywhere.
- Vary section shapes: a grid, then a split image/text, then a full-width quote.
  Avoid a page that is only stacked identical card grids.
- One bold element per page (the hero visual or a type treatment). Keep the rest calm.
- Wrap content groups in `<Reveal>` with staggered `delay={index * 80}`;
  `BentoGrid`, `Testimonials` and `PricingTable` already reveal themselves.
- Mobile first: single column below `md`, CTA buttons full width on phones
  (`w-full sm:w-auto`), tap targets at least 44px.

## 6. Conversion details

- Repeat the primary CTA after features or pricing and in the final `CtaBand`.
- Anchor navigation: give sections `id`s (`<Section id="pricing">`) and link to
  `#pricing`; add `scroll-mt-20` so the sticky header does not cover headings.
- Forms on the page: ask for the minimum (email, or name + phone). Show inline
  validation and a clear success state (see the forms-validation skill).
- Pricing: show the currency and billing period, highlight one plan, and state
  what happens after clicking (trial length, cancellation).
- Accessibility: visible focus, alt text on meaningful images, contrast 4.5:1,
  buttons that say what they do.

## 7. Done checklist

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
fail), detected `sections`, and `placeholders`. It is heuristic: confirm
failures by reading the code before changing anything.
