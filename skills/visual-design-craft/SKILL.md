---
slug: visual-design-craft
name: Visual design craft
version: 1.0.0
description: Make a generated site look designed for its business, not templated - direction first, spacing that explains grouping, radius by role, signature moments, art-directed imagery and a review loop.
when_to_use: When designing or restyling visible pages, when a page looks generic or like every other generated site, when a UI designer or reviewer role needs a design brief to follow, or before calling a visual change done.
tags: [ui, design, visual, typography, spacing, review]
roles: [ui-designer, frontend-developer, reviewer]
license: MIT
references:
  - file: references/spacing-and-alignment.md
    description: Grouping by relationship, inner versus outer gaps, alignment axes, radius by component role and nested corners.
  - file: references/design-review.md
    description: How to review a page against its design direction - whole page, then groups, then details - and write findings as relationships.
  - file: references/imagery-and-detail.md
    description: Art direction for photos and illustrations, signature moments, typographic details, motion and state polish.
---

# Visual design craft

Generated sites look alike when every decision falls back to a default: the
same centered hero, three icon cards, `rounded-2xl` on everything, one teal or
indigo primary and a soft grey shadow. This skill is about replacing each
default with a decision that belongs to this business.

## 1. Work from the direction

Every app has a design direction: an archetype (editorial, swiss-grid,
luxury-minimal, playful-illustrated, bold-brutalist, tech-dark, organic-craft,
retro-vintage, soft-pastel, data-dense-pro, corporate-trust, thai-modern) plus
palette, fonts, density, shape language, depth, imagery style, layout concept,
signature moments and anti-goals. Find it in the approved blueprint, in
`DESIGN.md`, or in the brief your task gives you, and follow it exactly. If
none exists and you are the lead, fix one before building (with
`suggest_design_directions` when available); a team member reports the gap to
the lead instead of inventing one.

Read the anti-goals as hard limits. "Not corporate" rules out the blue split
hero with stock handshakes; "not cute" rules out pastel blobs.

## 2. Tokens, then components

The look lives in the token block of the global stylesheet (between the
`kodra:design-tokens` markers): colors, `--font-heading`, `--font-body`,
`--type-scale`, the radius ladder, shadows, `--density`, `--section-y` and
`--container-max`. Change tokens before touching components. A block still
marked UNSET, or the neutral grey defaults, means the direction was never
applied: regenerate it first.

shadcn/ui components are the base for controls. Restyle them through tokens
and their `cva` variants (editing `src/components/ui` for a variant is fine;
keep props, behavior and accessibility), or wrap them. Never leave a stock look
that contradicts the direction.

## 3. Composition

- Choose the page narrative from the business (story-led, product tour,
  editorial, catalog-first, single-screen, dashboard), then the block variants.
  Blocks in `src/components/app` are starting points, not a template.
- At least one bespoke section per page, built for this content only: a menu
  board, a map of the delivery area, a before/after slider, a timeline, a
  calculator, a process shown in real photos.
- One signature moment per page, taken from the direction. Spend boldness
  there and keep the rest disciplined.
- Rhythm: change section width, spacing and tone on purpose. A narrow airy
  story, then a full-bleed image, then a tight dense list reads as designed; six
  identical bands read as generated.
- Hierarchy through contrast: not every element is equally large, equally
  spaced or equally prominent. One primary action per area.

See `references/spacing-and-alignment.md` for grouping and radius rules.

## 4. Content is design

Use the owner's real content verbatim: business name, services, menu items,
prices, hours, addresses, their own phrases. Specific content is the cheapest
way to make a page look unlike any other. Never invent testimonials, logos,
ratings or statistics; leave the block out or mark the gap for the owner.
For Thai, follow the thai-localization skill (line-height, no negative
tracking, no uppercase or italics on Thai).

## 5. Detail checklist

- Signature moment and bespoke section present.
- Navigation and footer have a treatment that matches the direction.
- Type roles consistent; tabular numerals for prices and stats; eyebrows only
  where they orient; balanced headline wrapping.
- Section transitions marked (divider, band, color shift, full-bleed image).
- Imagery consistent in crop, color treatment and distance; no stock clichés or
  gray boxes. See `references/imagery-and-detail.md`.
- Hover and press states on everything clickable, hover only for real pointers
  (`@media (hover: hover)`), visible focus, reduced-motion respected.
- Loading, empty, error and disabled states designed, not defaulted.
- Dark mode (if offered), long names, long Thai lines and missing images do not
  break the layout; nothing overflows at 390px.

## 6. Review before done

Look at the rendered page at desktop and mobile widths (preview screenshots,
and `design_critique` when available), and review it against the direction
using `references/design-review.md`. Fix findings at their source (tokens,
then the shared block, then the page) and look again. A passing build is not a
visual review. Do not trade the direction for a safer generic look to make a
score go up.

The grouping, radius and review guidance in this skill is adapted from DeepSeek Harness (MIT).
