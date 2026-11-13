# Reviewing a page against its direction

Adapted from DeepSeek Harness (MIT, Copyright (c) 2026 DeepSeek); see the KODRA repository's THIRD_PARTY_NOTICES.md.

Review the rendered page, not the code. Source inspection and passing checks
do not establish what the user sees.

## Scope

- A local change (copy, one color, one component): inspect the changed element
  with its direct neighbours and the states it can affect.
- A page layout or new page: review the whole page, including content below
  the fold, expanded sections and the mobile layout.
- A shared block or token change: look at every page that uses it, at least
  one with long content and one with little content.

Inspect what the change can affect, not every width x theme x state
combination. Say what you did not check.

## Three passes

1. **Whole page.** Does it match the direction (archetype, palette, type,
   shape, depth, imagery, anti-goals)? Is there a signature moment and a
   bespoke section? Could this page belong to a different business if you
   swapped the logo? If yes, that is the first finding.
2. **Between groups.** Section transitions, rhythm changes, heading-to-content
   distance versus distance to the previous section, shared text axes across
   sections, one primary action per area.
3. **Within groups.** Field parts, card internals, icon/label pairs, radius by
   role, hover/focus/disabled states, Thai line-height and clipping.

## Write findings as relationships

A useful finding names the elements, the relationship that is wrong and the
fix: "The section title sits 24px below the previous cards but 32px above its
own text, so it reads as a caption of the cards; tighten title-to-text and
separate the sections." "Looks off" or "uses tokens correctly" is not a
finding.

Prioritise findings that mislead (a primary action that looks disabled, a
selection that looks like hover), then the ones that make the page generic,
then polish. Fix at the owner: tokens first, then the shared block, then the
page.

## States that must stay legible together

- Selected next to hovered: the current item still reads as current.
- Selected and focused: keyboard focus stays visible.
- Disabled: unavailable, but the chosen value is still readable.
- Loading, empty and error: each says what is happening and what to do next,
  and does not shift the layout around it.

## Report

State what changed, which widths and states you looked at, and any gap (for
example dark mode not checked). Do not claim full coverage you did not see.
