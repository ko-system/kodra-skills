---
slug: accessibility-audit
name: Accessibility audit
version: 1.0.0
description: WCAG 2.1 AA checklist and fixes for React apps covering alt text, form labels, keyboard access, visible focus, color contrast, headings, landmarks and motion.
when_to_use: Before shipping any page with forms, images, dialogs or custom controls, when a user reports keyboard or screen reader problems, or as the QA pass on a finished feature.
tags: [ui, a11y, accessibility, wcag, qa]
roles: [qa-tester, ui-designer, frontend-developer]
license: MIT
references:
  - file: references/checklist.md
    description: Full WCAG 2.1 AA checklist grouped by component type, each item with a React/Tailwind fix.
scripts:
  - name: a11y_static_scan
    file: scripts/a11y_static_scan.js
    description: Lists images without alt text, unlabeled form controls, icon-only buttons without names, click handlers on non-interactive elements, positive tabIndex and removed focus outlines.
    writes: false
---

# Accessibility audit

Goal: every user can perceive the content, operate every control with a
keyboard or screen reader, and understand what happened. shadcn/ui (Radix)
primitives already handle focus traps, ARIA roles and keyboard support; most
failures come from app code around them.

## Audit workflow

1. Run `a11y_static_scan` and fix every `error`, then review `warn` items.
2. Read the page code for what a scan can't see (below).
3. Keyboard pass: Tab through the page from the address bar. Every
   interactive element gets focus in visual order, focus is always visible,
   Enter/Space activate, Escape closes overlays, focus returns to the trigger.
4. Visual pass at 200% zoom and in dark mode if the app has one.
5. Write down what you fixed and anything that needs the owner (e.g. brand
   colors that fail contrast).

## The ten fixes that matter most

1. **Images:** meaningful `<img>` gets an `alt` describing its purpose
   ("Chef plating pad thai"); decorative ones get `alt=""`. Icons next to text:
   `aria-hidden="true"`. Never `alt="image"` or the file name.
2. **Form labels:** every input has a visible `<Label htmlFor>` or is inside
   shadcn `FormItem` + `FormLabel` + `FormControl` (which wires `id`,
   `aria-describedby` and `aria-invalid`). Placeholder is not a label.
3. **Icon-only buttons:** `aria-label="Delete invoice INV-102"` (or a
   `<span className="sr-only">`). Name the action and the object.
4. **Real elements:** use `<button>` for actions and `<a href>`/`<Link>` for
   navigation. No `onClick` on `div`/`span`/`li`. If unavoidable, add
   `role="button"`, `tabIndex={0}` and Enter/Space handling.
5. **Visible focus:** never remove outlines without a replacement. Use
   `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`.
6. **Contrast:** text 4.5:1 (3:1 for 18px+ bold or 24px+ regular), UI
   boundaries and icons 3:1. `text-muted-foreground` on `bg-muted` and
   placeholder text are the usual failures; adjust the tokens, not single
   components.
7. **Headings and landmarks:** one `h1` per page, no skipped levels for
   structure; wrap content in `<header>`, `<nav aria-label>`, `<main id="main">`,
   `<footer>`. Add a "Skip to content" link as the first focusable element.
8. **Errors and status:** form errors are text next to the field (not color
   only) and connected via `aria-describedby`; async results use a toast
   (sonner has a live region) or `role="status"`/`aria-live="polite"`.
9. **Dialogs and menus:** use shadcn `Dialog`, `Sheet`, `DropdownMenu`,
   `Popover` rather than custom divs. Each `DialogContent` needs a
   `DialogTitle` (use `className="sr-only"` if it must be hidden).
10. **Motion:** honor `prefers-reduced-motion` (`motion-safe:` /
    `motion-reduce:` classes); nothing flashes more than 3 times per second;
    auto-playing carousels have a pause control.

## Things a static scan can't catch

- Wrong reading order from CSS `order-*` or absolute positioning.
- Focus lost after an action (e.g. deleting a row leaves focus on `body`).
  Move focus to a sensible element (the next row, or the list heading).
- Route changes in a SPA: update `document.title` and move focus to the new
  page's `h1` (or announce it), otherwise screen readers hear nothing.
- Content that only appears on hover.
- Contrast of text over images or gradients: add an overlay
  (`bg-black/50`) or a solid panel behind text.
- Custom widgets (comboboxes, tabs, sliders) not built from Radix: check the
  WAI-ARIA Authoring Practices pattern and its keyboard model.
- Language: `<html lang="...">` matches the content; mark inline phrases in
  another language with `lang` (e.g. `<span lang="th">`).

## Patterns

```tsx
// Icon-only button
<Button variant="ghost" size="icon" aria-label={`Remove ${item.name} from cart`}>
  <Trash2 className="h-4 w-4" aria-hidden="true" />
</Button>

// Toggle button state
<Button variant="outline" aria-pressed={isFavorite} onClick={toggle}>
  <Heart className={cn("h-4 w-4", isFavorite && "fill-current")} aria-hidden="true" />
  {isFavorite ? "Saved" : "Save"}
</Button>

// Skip link (first child of the layout)
<a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:ring-2 focus:ring-ring">
  Skip to content
</a>

// Live status for async work
<p role="status" aria-live="polite" className="sr-only">{statusMessage}</p>
```

## Report format

When asked for an audit, report findings as a table: `Severity | Where
(file:line or page) | Problem | WCAG criterion | Fix`. Severity: blocker
(prevents a task), serious, minor. Fix blockers first.

## Script

`a11y_static_scan` args (optional): `{ "dir": "src", "includeUi": false,
"maxFindings": 150 }`. It scans `.tsx/.jsx` files and `index.html` /
`app/layout.tsx` for `<html lang>`. It skips `src/components/ui/` unless
`includeUi` is true. Rules: `img-alt`, `control-label`, `button-name`,
`link-name`, `link-href`, `click-non-interactive`, `positive-tabindex`,
`focus-outline-removed`, `html-lang`, `autofocus`. It is heuristic (for
example a label may be associated in another file); verify before changing.
