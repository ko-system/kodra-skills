---
slug: crud-dashboard
name: CRUD admin dashboard
version: 1.0.0
description: Admin and back-office screens with data tables, search and filters, server-side pagination, sorting, create/edit dialogs, bulk actions, confirmations and empty states.
when_to_use: When building an admin panel, back office, inventory, orders, bookings, members or any list-plus-detail screen where staff create, edit, filter and delete records.
tags: [ui, dashboard, admin, crud, tables]
roles: [frontend-developer, backend-developer, ui-designer]
license: MIT
references:
  - file: references/data-table.md
    description: Complete data table component with URL-synced filters, sorting, pagination, row selection and bulk actions, plus the matching API route.
---

# CRUD admin dashboard

Staff use dashboards all day. Optimize for scanning, finding and fixing
records quickly, with no surprises on destructive actions.

## Screen anatomy

```
PageHeader: title, one-line description, primary action ("New order")
StatCard row (optional): 2-4 numbers that matter today, each linking to a filtered list
FilterBar: search, 1-3 filters, active filter chips, "Clear"
Table: selectable rows, sortable columns, row actions menu
Pagination: "Showing 21-40 of 312", previous/next, page size
Bulk action bar: appears when rows are selected
Create/Edit: Dialog or Sheet (short forms) or a dedicated page (long forms)
```

Use the scaffold blocks (`PageHeader`, `FilterBar`, `StatCard`,
`StatusBadge`, `EmptyState`) with shadcn `Table`, `DropdownMenu`, `Dialog`,
`Sheet`, `AlertDialog`, `Checkbox`, `Select`, `Input`, `Pagination`.

## Data rules

1. **Paginate on the server** once a table can exceed ~200 rows. The API
   accepts `page`, `pageSize` (cap at 100), `sort`, `dir`, `q` and filters, and
   returns `{ items, total }`.
2. **Whitelist sort columns** on the server (map `"createdAt"` to a column);
   never interpolate user input into SQL.
3. **URL is the state.** Search, filters, sort and page live in the query
   string (`useSearchParams`), so refresh, back button and shared links work.
   Reset `page` to 1 whenever a filter or search changes.
4. **Debounce search** (300 ms) and keep the previous page visible while the
   next loads (`placeholderData: keepPreviousData`).
5. **Authorize every mutation on the server** (role check or RLS). Hiding a
   button is not access control.
6. **Soft-delete** business records (`deleted_at`) when they may need
   restoring or are referenced by other records (orders, invoices).

## Table design

- Left-align text, right-align numbers and money (`text-right tabular-nums`),
  format dates in the user's locale, show relative time with the exact date
  in a `title`/tooltip.
- First column is the record's human identifier, linked to its detail view.
- Status as `StatusBadge` with text, not color alone.
- Row actions in a `DropdownMenu` behind a `MoreHorizontal` icon button with
  `aria-label="Actions for order #1042"`. Put the most common action (Edit)
  first and destructive actions last, separated, in `text-destructive`.
- Sortable headers are buttons inside `TableHead` with `aria-sort` on the
  header cell and an arrow icon showing the direction.
- Sticky header for long tables: `TableHeader className="sticky top-0 bg-background"`.
- Below `md`, switch to stacked cards or allow horizontal scroll
  (`overflow-x-auto` wrapper); never squeeze 8 columns into 375px.
- Loading: `Skeleton` rows matching the column layout; keep header,
  filters and pagination rendered.

## Create and edit

- Short forms (up to ~6 fields): `Dialog` or right-side `Sheet`. Long forms
  or forms with sub-records: a page (`/orders/:id/edit`).
- Reuse one form component for create and edit (`defaultValues` from the
  record or empty). Validate with the shared zod schema (forms-validation skill).
- After save: close the dialog, toast "Order #1042 updated", invalidate
  the list and the detail query, and keep the user's place (page, filters).
- Prevent accidental close with unsaved changes (confirm when `isDirty`).

## Delete and bulk actions

- Single delete: `AlertDialog` naming the record: "Delete order #1042? This
  can't be undone." Destructive button labelled "Delete order".
- Bulk: a bar appears when rows are selected: "3 selected", actions, "Clear
  selection". Confirm destructive bulk actions with the count.
- Select-all selects the current page; offer "Select all 312 results" only if
  the server supports filter-based bulk operations.
- After bulk actions, clear the selection and report the result, including
  partial failures ("Archived 18 of 20. 2 orders are already shipped.").

## Empty, error and edge states

| Situation                | Show                                                           |
| ------------------------ | -------------------------------------------------------------- |
| No records yet           | `EmptyState` with what the list is for + primary create action |
| Filters match nothing    | "No orders match these filters" + "Clear filters"              |
| Load failed              | Error notice with retry; keep last good data if any            |
| Permission denied        | Explain who can access it; no broken table                     |
| Record deleted elsewhere | Toast + refresh list when an edit returns 404                  |
| Concurrent edit          | 409 from server (compare `updated_at`), offer reload           |

## Dashboard home (stats)

- 2-4 `StatCard`s with numbers people act on ("Orders to ship today: 12"),
  each linking to the filtered list. Avoid vanity totals.
- Charts (shadcn `chart` + Recharts) only when trend matters; label axes and
  provide the numbers as text too.
- Compute aggregates on the server (`COUNT`, `SUM ... GROUP BY`), never by
  downloading all rows.

## Done checklist

- [ ] Server pagination, sorting and filtering with whitelisted columns.
- [ ] URL holds search/filter/sort/page; page resets on filter change.
- [ ] Loading skeleton, empty (two kinds), error states.
- [ ] Create/edit share one validated form; toasts on success and failure.
- [ ] Destructive actions confirmed and named; bulk actions report results.
- [ ] Row actions and icon buttons have accessible names.
- [ ] Mobile layout checked at 375px.
- [ ] Mutations authorized on the server.
