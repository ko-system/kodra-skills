---
slug: database-schema-design
name: Database schema design
version: 1.0.0
description: Relational modelling for Postgres apps covering keys, relationships, constraints, indexes, timestamps, soft deletes, money and enums, drizzle schemas and migrations, and row-level security notes.
when_to_use: Before creating tables for a new feature, when adding relationships, multi-tenant or per-user data, when queries get slow, or when choosing between Supabase, Neon, local Postgres or drizzle for schema changes.
tags: [database, postgres, schema, drizzle, sql, security]
roles: [database-engineer, backend-developer]
license: MIT
references:
  - file: references/patterns.md
    description: Schema templates (users and profiles, organizations and members, catalog and orders, bookings, audit log), drizzle examples, index recipes and RLS policy templates.
---

# Database schema design

Design the tables before writing UI. A good schema makes invalid data
impossible, keeps queries simple and stays fast as rows grow.

## How schema changes are applied (read first)

Follow the app's database provider rules; they override this skill:

- **KODRA-connected Supabase, Neon or built-in local Postgres:** apply DDL
  through the provider's SQL execution tool. Do not hand-write migration
  files (`supabase/migrations/`, drizzle migration folders) for these apps.
  For local Postgres, also keep `db/schema.sql` current as the provider guide
  describes.
- **App that already uses drizzle-kit migrations** (has `drizzle.config.ts`
  and a migrations folder, self-managed database): edit the drizzle schema,
  then generate a migration with the project's script (e.g.
  `npx drizzle-kit generate`) and review the SQL. Never edit an applied
  migration; add a new one.
- In every case: inspect the live schema first (the provider's schema tool, or
  the drizzle schema file) and make additive, backwards-compatible changes.

## Modelling checklist

1. **Nouns become tables, verbs become rows or join tables.** "Customers
   place orders containing products" → `customers`, `orders`,
   `order_items(order_id, product_id, quantity, unit_price_cents)`.
2. **Primary keys:** `id uuid primary key default gen_random_uuid()` for
   anything exposed in URLs or synced across systems; `bigint generated always
as identity` is fine for internal tables. Use one convention per app.
   Human-friendly numbers (order #1042) are a separate unique column.
3. **Foreign keys everywhere** relationships exist, with an explicit
   `on delete` rule: `cascade` for owned children (order_items),
   `restrict` for referenced records (products in orders), `set null` for
   optional links. Index every foreign key column.
4. **Constraints over code:** `not null` by default, `check` for ranges and
   enums, `unique` for natural keys (email per tenant, slug). Validation in the
   UI is not enough.
5. **Timestamps:** `created_at timestamptz not null default now()` and
   `updated_at timestamptz not null default now()` (updated by trigger or by
   every update statement). Always `timestamptz`, never `timestamp`.
6. **Money:** integer minor units (`total_cents integer`/`bigint`) plus a
   `currency char(3)` when more than one currency is possible. Never floats.
7. **Status fields:** `text not null check (status in ('pending','paid','shipped','cancelled'))`
   is easier to evolve than a Postgres enum type. Keep display labels in
   the app.
8. **Snapshot what must not change:** orders copy `unit_price_cents` and
   product name at purchase time; addresses on an order are copied, not
   referenced.
9. **Soft delete** (`deleted_at timestamptz`) for business records that are
   referenced or may need restoring; filter `deleted_at is null` and use
   partial unique indexes (`unique (email) where deleted_at is null`).
10. **Avoid** comma-separated lists, `data jsonb` dumping grounds for core
    fields, polymorphic `owner_type/owner_id` without FKs, and one giant
    `settings` table. `jsonb` is fine for truly flexible, rarely-queried
    attributes.

## Naming

- Tables plural snake*case (`order_items`), columns snake_case, FKs
  `<singular>_id` (`customer_id`), booleans `is*`/`has\_` (`is_active`),
timestamps `\_at`, dates `\_on` (`due_on date`).
- Map to camelCase in the API layer (SQL aliases or drizzle column names).

## Multi-user and multi-tenant data

- Per-user data: `user_id uuid not null references auth.users(id)` (Supabase)
  or your users table; every query filters by the signed-in user.
- Teams/workspaces: `organizations`, `memberships(organization_id, user_id,
role)` with `unique (organization_id, user_id)`; every tenant-owned table
  has `organization_id` (indexed) and every query filters by it.
- Enforce it in one layer that cannot be bypassed:
  - **Supabase (client queries):** row-level security is mandatory. Enable
    RLS on every exposed table and write policies for each operation used.
  - **Server-only access** (API routes with a server-side connection string,
    local Postgres, Neon serverless driver): authorization lives in server
    code; filter by user/tenant in every query. RLS is optional unless the
    provider guide requires it.
  - Never expose a service-role key or admin connection string to the browser.

## Indexes

- Primary keys and `unique` constraints are indexed automatically; foreign
  keys are **not**: add them.
- Index for the queries you run: equality columns first, then range/sort
  columns: `(organization_id, status, created_at desc)` serves "this org's
  pending orders, newest first".
- Partial indexes for common filters: `where deleted_at is null`.
- Case-insensitive lookups: `unique (lower(email))` or the `citext` type.
- Text search: `pg_trgm` GIN index for `ILIKE '%term%'`; full-text
  (`tsvector`) for document search.
- Don't index every column; each index slows writes. Check slow queries with
  `EXPLAIN ANALYZE`.

## Safe changes on live data

| Change                   | Safe approach                                                      |
| ------------------------ | ------------------------------------------------------------------ |
| Add column               | Nullable or with a constant default; backfill; then `set not null` |
| Rename column            | Add new, dual-write/backfill, switch reads, drop old later         |
| Change type              | New column + backfill; avoid rewriting large tables in place       |
| Add FK / check           | `not valid` first, then `validate constraint`                      |
| Add index on a big table | `create index concurrently` (outside a transaction)                |
| Drop column/table        | Remove code usage first; confirm with the owner; back up data      |

Destructive changes (drop, truncate, type narrowing) need the owner's
explicit confirmation.

## Seed and test data

- Seed through the app's API or a clearly named seed script, never into
  production by accident.
- Keep test data isolated; KODRA's test runs provide isolated data for managed
  providers (see the qa-smoke-tests skill).

## Deliverable

When designing a schema, present: an entity list with relationships (a
short ER sketch in text is enough), the DDL, indexes with the query each one
serves, the access rule for each table (RLS policy or server check), and any
data that must be backfilled. See `references/patterns.md` for templates.
