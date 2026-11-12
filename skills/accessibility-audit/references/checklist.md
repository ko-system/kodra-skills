# WCAG 2.1 AA checklist for React apps

Each item: what to check, then the fix. Criterion numbers in brackets.

## Page

- [ ] `<html lang>` matches the content language [3.1.1]. Vite: `index.html`;
      Next.js: `<html lang="th">` in `app/layout.tsx`.
- [ ] Unique, descriptive `<title>` per route [2.4.2]. SPA: set
      `document.title` in each page (see the seo-metadata skill).
- [ ] Landmarks: one `<main>`, `<header>`, `<footer>`; multiple `<nav>` have
      distinct `aria-label`s [1.3.1].
- [ ] Skip link to `#main` as the first focusable element [2.4.1].
- [ ] One `h1`; headings describe sections; no level used only for size [1.3.1, 2.4.6].
- [ ] Content reflows at 320px width and 200% zoom without horizontal
      scrolling (except tables, maps) [1.4.10].
- [ ] Text spacing can increase (line-height 1.5, letter spacing 0.12em)
      without clipping: avoid fixed heights on text containers [1.4.12].

## Images and media

- [ ] Informative images: `alt` conveys the information [1.1.1].
- [ ] Decorative images and icons: `alt=""` / `aria-hidden="true"`.
- [ ] Images of text avoided; if used, alt contains the text [1.4.5].
- [ ] Charts: a text summary or data table next to the chart. Recharts:
      add `role="img"` and `aria-label` on the wrapper, plus a visible summary.
- [ ] Video: captions; audio: transcript [1.2.x]. No autoplay with sound.
- [ ] SVG icons used as the only content of a control: the control has an
      accessible name (`aria-label`), the SVG is `aria-hidden`.

## Color and contrast

- [ ] Body text 4.5:1; large text (24px, or 18.66px bold) 3:1 [1.4.3].
- [ ] Focus rings, input borders, icons needed to understand UI: 3:1 against
      adjacent colors [1.4.11].
- [ ] Color is never the only signal: errors have text, required fields
      say "required", links in body text are underlined [1.4.1].
- [ ] Check both light and `.dark` tokens. Common fixes: darken
      `--muted-foreground`, darken `--input` border, avoid white text on
      light brand colors.

## Keyboard and focus

- [ ] Every action reachable and operable by keyboard [2.1.1]; no traps
      except modal dialogs, which release on Escape [2.1.2].
- [ ] Focus order follows visual order [2.4.3]; no positive `tabIndex`.
- [ ] Focus visible on every interactive element [2.4.7]:
      `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`.
- [ ] After closing a dialog, focus returns to the trigger (Radix does this).
- [ ] After deleting or moving an item, focus moves somewhere predictable.
- [ ] Single-key shortcuts can be turned off or need a modifier [2.1.4].
- [ ] Nothing changes context on focus or on input alone (no auto-submit on
      select change) [3.2.1, 3.2.2].

## Forms

- [ ] Every control has a programmatic label [1.3.1, 4.1.2]:
      `<Label htmlFor="email">` + `<Input id="email">`, or shadcn
      `FormLabel` + `FormControl`.
- [ ] Required fields marked in text and with `required` / `aria-required` [3.3.2].
- [ ] Errors identified in text, next to the field, and linked with
      `aria-describedby`; field gets `aria-invalid="true"` [3.3.1].
- [ ] On submit failure, focus moves to the first invalid field
      (react-hook-form does this with `shouldFocusError`, on by default).
- [ ] Error messages suggest the fix [3.3.3]. Destructive or financial
      submissions can be reviewed or undone [3.3.4].
- [ ] `autoComplete` tokens on personal data fields (`name`, `email`, `tel`,
      `street-address`, `postal-code`, `cc-number`) [1.3.5].
- [ ] Group related radios/checkboxes in `<fieldset>` with `<legend>`
      (shadcn `RadioGroup` + a visible group label with `aria-labelledby`).

## Buttons and links

- [ ] Buttons have names that describe the action; identical names for
      different actions are disambiguated ("Edit profile", "Edit address") [2.4.6].
- [ ] Links say where they go; no bare "click here" / "read more" without
      context (add `sr-only` text: "Read more <span className="sr-only">about pricing</span>") [2.4.4].
- [ ] Links that open a new tab say so (text or icon with label).
- [ ] Disabled buttons: prefer keeping them enabled and showing validation
      errors on click, so users learn what is missing.
- [ ] Touch targets at least 24x24px (AA in WCAG 2.2) and 44x44px recommended.

## Dynamic content

- [ ] Toasts and inline status messages are announced (`role="status"` or
      sonner/shadcn toasts) [4.1.3].
- [ ] Loading states: `aria-busy="true"` on the region; spinners have a
      text label ("Loading invoices").
- [ ] Infinite scroll has an alternative ("Load more" button).
- [ ] Time limits can be extended [2.2.1]; carousels and marquees pause [2.2.2].
- [ ] SPA route change: focus the new `h1` (with `tabIndex={-1}`) or announce
      the page title.

## Components (shadcn/ui notes)

| Component         | Check                                                                                                                        |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Dialog / Sheet    | Has `DialogTitle`/`SheetTitle` (visually hidden is OK) and description or `aria-describedby={undefined}`                     |
| DropdownMenu      | Trigger is a `Button` with a name; items are `DropdownMenuItem`                                                              |
| Tabs              | Use `Tabs` primitives, not buttons styled as tabs                                                                            |
| Table             | `<TableHead>` cells for headers; caption or `aria-label` on table; sortable headers are buttons with `aria-sort` on the `th` |
| Tooltip           | Never the only way to get information; not on disabled buttons                                                               |
| Select / Combobox | Labelled via `FormLabel` or `aria-label` on the trigger                                                                      |
| Toast             | Keep important actions out of auto-dismissing toasts                                                                         |
| Carousel          | Prev/next buttons have labels; slides are not auto-advancing                                                                 |

## Testing tools

- Keyboard only (Tab, Shift+Tab, Enter, Space, Escape, arrows).
- Screen reader smoke test: VoiceOver (macOS: Cmd+F5) or NVDA (Windows).
- Browser devtools accessibility tree and contrast picker.
- Playwright: `await expect(page.getByRole("button", { name: "Save changes" })).toBeVisible()`
  doubles as an accessible-name check. Role-based locators failing to find
  an element is often an accessibility bug.
