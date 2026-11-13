# Imagery, signature moments and detail

Parts of the illustration guidance are adapted from DeepSeek Harness (MIT, Copyright (c) 2026 DeepSeek); see the KODRA repository's THIRD_PARTY_NOTICES.md.

## Art direction for photos

- Decide the treatment once and apply it everywhere: crop ratios (for example
  4:5 portraits, 3:2 scenes), subject distance (close detail or wide context),
  light (warm daylight, studio, night), and color handling (natural, muted,
  duotone with the primary).
- Show the actual business: the dishes, the room, the team at work, the product
  in use. Generic stock (handshakes, laptops on white desks, people pointing at
  screens) makes every site look the same.
- When generating images, write the treatment into every prompt (subject,
  composition, light, palette, mood, aspect ratio) so the set looks like one
  shoot.
- Give every image fixed dimensions or an aspect ratio, meaningful alt text and
  an `onError` fallback; never ship gray placeholder boxes.

## Illustrations and icons

- Start simple: one dominant subject and only the detail needed to explain it.
- Keep geometry consistent across a set (stroke width, corner style, level of
  detail, viewing angle).
- Use restrained color matched to the palette; tune saturation separately from
  hue. Avoid glossy highlights, drop shadows on icons and emoji as icons.
- Check every illustration at its real size and in both themes.

## Signature moments

A signature moment is the one thing someone remembers. Take it from the
direction and the content, for example:

- an oversized editorial headline set in the display face with a hand-placed
  line break;
- a menu board that looks like the shop's chalkboard;
- a large real number (`StatShowcase` spotlight) with its source;
- a map of the delivery area or the trail;
- a before/after comparison slider for a clinic or renovation;
- a marquee of the shop's real product names in the brand color.

One per page is enough; keep everything around it quiet.

## Typographic detail

- Tabular numerals (`tabular-nums`) for prices, stats and tables.
- Tightened tracking only on large Latin display text, never on Thai.
- Real quotation marks and dashes; balanced headline wrapping (`text-balance`).
- Eyebrows and kickers only where they orient the reader, not above every
  heading; no ALL-CAPS on Thai.

## Motion and state polish

- Reveal content groups once on scroll; never the hero.
- Hover and press feedback on everything clickable, matched to the direction
  (lift, border color, image zoom, offset shadow), only for real pointers
  (`@media (hover: hover)`).
- Animate state changes (open, expand, confirm, a number settling), not
  decoration. Respect reduced motion.
- Design the empty, loading and error states with the same care as the full
  state: they are what a first-time visitor often sees.
