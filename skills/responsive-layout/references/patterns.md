# Responsive patterns

Copy and adapt. All examples use semantic Tailwind tokens and shadcn/ui.

## App shell with collapsible sidebar

```tsx
import { useState } from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export function AppShell({
  nav,
  children,
}: {
  nav: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="min-h-dvh bg-background lg:grid lg:grid-cols-[16rem_1fr]">
      <aside className="hidden border-r border-border lg:block">
        <nav className="sticky top-0 h-dvh overflow-y-auto p-4">{nav}</nav>
      </aside>
      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-background/90 px-4 backdrop-blur lg:hidden">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-11 w-11"
                aria-label="Open navigation"
              >
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-4">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <nav onClick={() => setOpen(false)}>{nav}</nav>
            </SheetContent>
          </Sheet>
        </header>
        <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
```

`min-w-0` on the content column prevents wide children (tables, code) from
pushing the grid wider than the screen.

## Table that becomes cards on mobile

```tsx
<div className="hidden md:block overflow-x-auto rounded-lg border border-border">
  <Table>{/* full table */}</Table>
</div>
<ul className="space-y-3 md:hidden">
  {rows.map((row) => (
    <li key={row.id} className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 font-medium break-words">{row.name}</p>
        <StatusBadge tone={row.tone}>{row.status}</StatusBadge>
      </div>
      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        <dt className="text-muted-foreground">Amount</dt><dd className="text-right">{row.amount}</dd>
        <dt className="text-muted-foreground">Due</dt><dd className="text-right">{row.due}</dd>
      </dl>
    </li>
  ))}
</ul>
```

Render the two variants from the same `rows` array. If the list is long, keep
just one variant and use `overflow-x-auto` instead, to avoid rendering twice.

## Form layout

```tsx
<form className="grid gap-4 sm:grid-cols-2">
  <FormField ... render={() => (<FormItem>...</FormItem>)} />          {/* half width from sm */}
  <FormField ... render={() => (<FormItem className="sm:col-span-2">...</FormItem>)} /> {/* full width */}
  <div className="flex flex-col-reverse gap-2 sm:col-span-2 sm:flex-row sm:justify-end">
    <Button type="button" variant="outline" className="w-full sm:w-auto">Cancel</Button>
    <Button type="submit" className="w-full sm:w-auto">Save changes</Button>
  </div>
</form>
```

`flex-col-reverse` puts the primary button on top on phones (closest to the
thumb after the last field) and on the right on desktop.

## Dialogs on mobile

Use `Drawer` (vaul) below `md` and `Dialog` above for complex forms, or make
the dialog full-screen on phones:
`<DialogContent className="h-dvh max-h-dvh w-full max-w-none rounded-none sm:h-auto sm:max-w-lg sm:rounded-lg">`.
Keep the primary action reachable without scrolling past the keyboard.

## Hero split

```tsx
<section className="mx-auto grid max-w-7xl items-center gap-10 px-5 py-12 md:grid-cols-2 lg:py-20">
  <div className="order-2 md:order-1">...</div>
  <img
    className="order-1 aspect-[4/3] w-full rounded-2xl object-cover md:order-2"
    width={1200}
    height={900}
    alt="..."
  />
</section>
```

## Horizontal scrollers (chips, tabs)

```tsx
<div className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none]">
  <div className="flex w-max gap-2">{chips}</div>
</div>
```

Use for filter chips or category tabs that can't wrap. Make sure each item is
keyboard focusable and the active one scrolls into view.

## Fixed bottom action bar

```tsx
<div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:hidden">
  <Button className="h-11 w-full">Add to cart</Button>
</div>
```

Add bottom padding to the page (`pb-24 md:pb-0`) so content is not hidden.

## Device test matrix

| Width  | Represents                      | Look for                                 |
| ------ | ------------------------------- | ---------------------------------------- |
| 320px  | Small Android, iPhone SE zoomed | Horizontal scroll, clipped buttons       |
| 375px  | Common iPhone                   | CTA above the fold, readable text        |
| 768px  | Tablet portrait                 | Awkward 2-column breaks, orphan cards    |
| 1024px | Tablet landscape / small laptop | Sidebar appearance, table widths         |
| 1440px | Desktop                         | Over-wide lines (use max-w), empty space |

Also check landscape phones (667x375) for fixed headers that eat the screen,
and 200% browser zoom at 1280px.
