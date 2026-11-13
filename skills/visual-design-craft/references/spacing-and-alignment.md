# Spacing, alignment and radius

Adapted from DeepSeek Harness (MIT, Copyright (c) 2026 DeepSeek); see the KODRA repository's THIRD_PARTY_NOTICES.md.

Distance tells the reader which text, input and action belong together. Shape
tells them what kind of thing each element is. Decide both from relationships,
not from a single number applied everywhere.

## Identify the group before choosing the gap

Group elements by the object, action or repeated unit they belong to, not by
DOM siblings or component boundaries. A section title and its description
introduce one section; a label, input, helper text and error form one field;
fields form a form section; three cards form one set.

- Space within a group is visibly smaller than space between neighbouring
  groups, at every nesting level. Equal gaps are only the lower bound; when
  in doubt, separate groups more.
- A heading sits closer to its own content than to the previous section.
- Repeated units (cards, rows, list items) share the same internal gaps,
  padding and alignment. A longer label does not justify different spacing.
- When a group gets more complex (wrapping text, metadata, sub-actions),
  increase the separation around it so it still reads as one unit.
- Judge the rendered whitespace, including line-height, padding and borders,
  not only the class names. Two `mb-4`s can still leave a heading closer to
  the paragraph above it.

Density is about how much useful work fits, not about shrinking every gap.
Compact repeated rows can sit inside generous section spacing. When width
shrinks, reflow whole groups (stack the label above the input) instead of
squeezing text into a thin column.

## Alignment

- Name the axis and the objects on it: same-role text starts on one shared
  left edge across groups (nav labels, list titles, field labels).
- Center a standalone stack (empty state, a single primary button) within the
  space it actually owns, not with a fixed top margin.
- Title/action rows use two edges: the title follows the content edge, the
  action group follows the trailing edge.
- Repeated columns (prices, dates, row actions) share the same slot in every
  row.
- Icons and labels that form one unit share one color role; center the
  icon on the first text line, not the whole paragraph.

## Radius by role

Choose the component's role first, then its size variant, then the radius:

| Role | Examples | Radius step |
|---|---|---|
| Small detail | badges, chips, keycaps, inline code | `rounded-sm` |
| Control | buttons, inputs, selects, menu items | `rounded-md` |
| Grouped content | multi-line cells, nested form groups, media in cards | `rounded-lg` |
| Independent card | product, plan or testimonial cards | `rounded-xl` |
| Enclosing surface | dialogs, drawers, large panels | `rounded-2xl` |

The direction's shape language (sharp, soft, pill) sets the token values, so
the whole ladder moves together. Rules that hold in every direction:

- Same role, same radius. Hover, pressed, selected, loading and disabled
  states never change the radius or the size.
- A nested surface inset inside a rounded one uses inner radius = outer radius
  minus the inset. A header, image or footer flush with a card edge rounds only
  its exposed outer corners; let the card clip it (`overflow-hidden`).
- A hover fill or overlay follows the contour of the element it fills.
- Circles and pills are deliberate (avatars, status dots, tags, or a pill
  direction); do not turn every small button into a capsule.
- A taller card is still a card: do not give it the dialog radius because it
  grew.

## Depth

Elevation comes from `shadow-soft`, `shadow-card` and `shadow-pop` (set by the
direction: none, soft, hard offset, glow). Use one level per role, do not stack
shadows on borders on tinted backgrounds, and do not nest cards inside cards.
