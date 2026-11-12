# Schema patterns

Plain Postgres SQL first (works with Supabase, Neon and local Postgres), then
the drizzle equivalent where it differs. Apply DDL the way the app's
provider rules say (see SKILL.md).

## updated_at trigger

```sql
create or replace function set_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- per table:
create trigger orders_set_updated_at before update on orders
  for each row execute function set_updated_at();
```

## Profiles (Supabase auth)

```sql
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 80),
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table profiles enable row level security;
create policy "profiles are readable by their owner" on profiles
  for select using ((select auth.uid()) = id);
create policy "profiles are editable by their owner" on profiles
  for update using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
```

Wrap `auth.uid()` in `(select ...)` so Postgres evaluates it once per query.
Add the grants the Supabase provider rules require for API access.

## Organizations and memberships (multi-tenant)

```sql
create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique check (slug ~ '^[a-z0-9-]{3,40}$'),
  created_at timestamptz not null default now()
);

create table memberships (
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null,
  role text not null default 'member' check (role in ('owner','admin','member')),
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);
create index memberships_user_idx on memberships (user_id);
```

RLS helper for Supabase (tenant-owned tables have `organization_id`):

```sql
create or replace function is_member(org uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from memberships m
    where m.organization_id = org and m.user_id = (select auth.uid())
  );
$$;

create policy "members read projects" on projects
  for select using (is_member(organization_id));
create policy "members write projects" on projects
  for insert with check (is_member(organization_id));
```

Server-only apps: put the same check in a helper
(`assertMember(db, orgId, userId)`) called by every route.

## Catalog, carts and orders

```sql
create table products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text not null default '',
  price_cents integer not null check (price_cents >= 0),
  currency char(3) not null default 'THB',
  stock integer not null default 0 check (stock >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table orders (
  id uuid primary key default gen_random_uuid(),
  number bigint generated always as identity unique,
  user_id uuid,
  email text not null,
  status text not null default 'pending'
    check (status in ('pending','paid','fulfilled','shipped','cancelled','refunded')),
  subtotal_cents integer not null check (subtotal_cents >= 0),
  shipping_cents integer not null default 0 check (shipping_cents >= 0),
  total_cents integer not null check (total_cents >= 0),
  currency char(3) not null default 'THB',
  shipping_address jsonb,
  payment_provider_ref text unique,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index orders_user_created_idx on orders (user_id, created_at desc);
create index orders_status_created_idx on orders (status, created_at desc);

create table order_items (
  order_id uuid not null references orders(id) on delete cascade,
  product_id uuid not null references products(id) on delete restrict,
  product_name text not null,
  unit_price_cents integer not null check (unit_price_cents >= 0),
  quantity integer not null check (quantity > 0),
  primary key (order_id, product_id)
);
create index order_items_product_idx on order_items (product_id);
```

## Bookings without double-booking

```sql
create extension if not exists btree_gist;

create table bookings (
  id uuid primary key default gen_random_uuid(),
  resource_id uuid not null references resources(id) on delete restrict,
  customer_id uuid not null references customers(id),
  during tstzrange not null,
  status text not null default 'confirmed' check (status in ('confirmed','cancelled')),
  created_at timestamptz not null default now(),
  exclude using gist (resource_id with =, during with &&) where (status = 'confirmed')
);
```

The exclusion constraint makes overlapping confirmed bookings for the same
resource impossible, even under concurrent requests. Map the constraint error
(SQLSTATE `23P01`) to "That time was just taken; pick another slot".

## Audit log

```sql
create table audit_events (
  id bigint generated always as identity primary key,
  actor_id uuid,
  action text not null,           -- 'order.cancelled'
  entity_type text not null,      -- 'order'
  entity_id text not null,
  data jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index audit_events_entity_idx on audit_events (entity_type, entity_id, created_at desc);
```

Write audit rows in the same transaction as the change. Never store
passwords, tokens or full card data in `data`.

## drizzle-orm equivalents

```ts
// src/db/schema.ts (or server/db/schema.ts)
import { sql } from "drizzle-orm";
import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  char,
  index,
  primaryKey,
  check,
} from "drizzle-orm/pg-core";

export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    priceCents: integer("price_cents").notNull(),
    currency: char("currency", { length: 3 }).notNull().default("THB"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [check("products_price_check", sql`${t.priceCents} >= 0`)],
);

export const orderItems = pgTable(
  "order_items",
  {
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    quantity: integer("quantity").notNull(),
    unitPriceCents: integer("unit_price_cents").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.orderId, t.productId] }),
    index("order_items_product_idx").on(t.productId),
  ],
);

export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
```

- Column names stay snake_case in SQL; TypeScript keys are camelCase.
- Use `timestamp(..., { withTimezone: true })` for every timestamp.
- Use `$inferSelect` / `$inferInsert` types and `drizzle-zod`
  (`createInsertSchema`) if the app already has it, to keep zod schemas in sync.
- With KODRA-managed providers, the drizzle schema is a typed mirror of the
  live database; update it after every SQL change so types stay correct.
- Use transactions for multi-table writes:
  `await db.transaction(async (tx) => { ... })`.

## Index recipes

| Query                                                 | Index                                                            |
| ----------------------------------------------------- | ---------------------------------------------------------------- | --- | --- | ---- | ------------------------------------------------------- |
| `where org_id = $1 order by created_at desc limit 20` | `(org_id, created_at desc)`                                      |
| `where user_id = $1 and status = 'open'`              | `(user_id, status)` or partial `(user_id) where status = 'open'` |
| `where lower(email) = lower($1)`                      | `unique (lower(email))`                                          |
| `where name ilike '%'                                 |                                                                  | $1  |     | '%'` | `create extension pg_trgm;` + `gin (name gin_trgm_ops)` |
| `where tags @> array['vegan']`                        | `gin (tags)`                                                     |
| `where data->>'sku' = $1` (jsonb)                     | expression index `((data->>'sku'))`, or promote to a column      |

## Common constraint errors to map in the API

| SQLSTATE | Meaning               | User message example               |
| -------- | --------------------- | ---------------------------------- |
| 23505    | unique violation      | "That email is already registered" |
| 23503    | foreign key violation | "That product no longer exists"    |
| 23514    | check violation       | "Quantity must be at least 1"      |
| 23P01    | exclusion violation   | "That time slot was just booked"   |
