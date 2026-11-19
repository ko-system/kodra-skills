# Data table with URL state, sorting, pagination and bulk actions

Example entity: `orders`. Adapt names and columns. Uses shadcn/ui `Table`,
`Checkbox`, `DropdownMenu`, `Select`, `Input`, `Button`, and TanStack Query.

## 1. URL state hook

```ts
// src/hooks/use-table-params.ts
import { useSearchParams } from "react-router-dom"; // Next.js: useSearchParams/useRouter from "next/navigation"

export type SortDir = "asc" | "desc";

export function useTableParams<S extends string>(defaults: {
  sort: S;
  dir: SortDir;
  pageSize?: number;
}) {
  const [params, setParams] = useSearchParams();
  const state = {
    q: params.get("q") ?? "",
    status: params.get("status") ?? "",
    sort: (params.get("sort") as S | null) ?? defaults.sort,
    dir: (params.get("dir") as SortDir | null) ?? defaults.dir,
    page: Math.max(1, Number(params.get("page") ?? "1") || 1),
    pageSize: Number(params.get("pageSize") ?? defaults.pageSize ?? 20),
  };
  function update(patch: Partial<typeof state>, { resetPage = true } = {}) {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(patch)) {
      if (value === "" || value === undefined) next.delete(key);
      else next.set(key, String(value));
    }
    if (resetPage && !("page" in patch)) next.delete("page");
    setParams(next, { replace: true });
  }
  return [state, update] as const;
}
```

## 2. Query hook

```ts
// src/hooks/use-orders.ts
export type Order = {
  id: string;
  number: number;
  customer: string;
  total: number;
  status: "pending" | "paid" | "shipped" | "cancelled";
  createdAt: string;
};
export type OrderSort = "number" | "customer" | "total" | "createdAt";

export const orderKeys = {
  all: ["orders"] as const,
  list: (p: object) => ["orders", "list", p] as const,
};

export function useOrders(p: {
  q: string;
  status: string;
  sort: OrderSort;
  dir: "asc" | "desc";
  page: number;
  pageSize: number;
}) {
  const search = new URLSearchParams(
    Object.entries(p)
      .filter(([, v]) => v !== "")
      .map(([k, v]) => [k, String(v)]),
  );
  return useQuery({
    queryKey: orderKeys.list(p),
    queryFn: () =>
      fetchJson<{ items: Order[]; total: number }>(`/api/orders?${search}`),
    placeholderData: keepPreviousData,
  });
}

export function useBulkUpdateOrders() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { ids: string[]; status: Order["status"] }) =>
      fetchJson<{ updated: number; skipped: { id: string; reason: string }[] }>(
        "/api/orders/bulk",
        { method: "POST", body: JSON.stringify(input) },
      ),
    onSettled: () => qc.invalidateQueries({ queryKey: orderKeys.all }),
  });
}
```

## 3. Table component

```tsx
// src/components/orders/OrdersTable.tsx
const money = new Intl.NumberFormat("th-TH", {
  style: "currency",
  currency: "THB",
});
const date = new Intl.DateTimeFormat("th-TH", { dateStyle: "medium" });

function SortHeader({
  label,
  column,
  state,
  onSort,
  className,
}: {
  label: string;
  column: OrderSort;
  state: { sort: OrderSort; dir: "asc" | "desc" };
  onSort: (c: OrderSort) => void;
  className?: string;
}) {
  const active = state.sort === column;
  const Icon = !active
    ? ArrowUpDown
    : state.dir === "asc"
      ? ArrowUp
      : ArrowDown;
  return (
    <TableHead
      aria-sort={
        active ? (state.dir === "asc" ? "ascending" : "descending") : "none"
      }
      className={className}
    >
      <Button
        variant="ghost"
        size="sm"
        className="-ml-3 h-8"
        onClick={() => onSort(column)}
      >
        {label}
        <Icon className="ml-1 h-3.5 w-3.5" aria-hidden="true" />
      </Button>
    </TableHead>
  );
}

export function OrdersTable() {
  const [state, update] = useTableParams<OrderSort>({
    sort: "createdAt",
    dir: "desc",
  });
  const [search, setSearch] = useState(state.q);
  const debounced = useDebounced(search, 300);
  useEffect(() => {
    if (debounced !== state.q) update({ q: debounced });
  }, [debounced]); // eslint-disable-line react-hooks/exhaustive-deps

  const { data, isPending, isError, refetch, isPlaceholderData } =
    useOrders(state);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const bulk = useBulkUpdateOrders();
  useEffect(() => setSelected(new Set()), [state.page, state.q, state.status]);

  const items = data?.items ?? [];
  const allOnPage = items.length > 0 && items.every((o) => selected.has(o.id));
  const onSort = (column: OrderSort) =>
    update({
      sort: column,
      dir: state.sort === column && state.dir === "asc" ? "desc" : "asc",
    });
  const from =
    data && data.total > 0 ? (state.page - 1) * state.pageSize + 1 : 0;
  const to = data ? Math.min(state.page * state.pageSize, data.total) : 0;
  const totalPages = data
    ? Math.max(1, Math.ceil(data.total / state.pageSize))
    : 1;

  return (
    <div className="space-y-4">
      <FilterBar>
        <Input
          type="search"
          aria-label="Search orders"
          placeholder="Search by number or customer"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:w-72"
        />
        <Select
          value={state.status || "all"}
          onValueChange={(v) => update({ status: v === "all" ? "" : v })}
        >
          <SelectTrigger
            className="w-full sm:w-44"
            aria-label="Filter by status"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="shipped">Shipped</SelectItem>
          </SelectContent>
        </Select>
      </FilterBar>

      {selected.size > 0 && (
        <div
          role="region"
          aria-label="Bulk actions"
          className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-secondary px-4 py-2 text-sm"
        >
          <span>{selected.size} selected</span>
          <Button
            size="sm"
            disabled={bulk.isPending}
            onClick={() =>
              bulk.mutate(
                { ids: [...selected], status: "shipped" },
                {
                  onSuccess: (r) => {
                    toast.success(
                      r.skipped.length
                        ? `Marked ${r.updated} as shipped. ${r.skipped.length} skipped.`
                        : `Marked ${r.updated} as shipped.`,
                    );
                    setSelected(new Set());
                  },
                  onError: (e) => toast.error(e.message),
                },
              )
            }
          >
            Mark as shipped
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setSelected(new Set())}
          >
            Clear selection
          </Button>
        </div>
      )}

      {isError ? (
        <Notice tone="danger" title="Couldn't load orders">
          <Button size="sm" variant="outline" onClick={() => refetch()}>
            Try again
          </Button>
        </Notice>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <Table className={cn(isPlaceholderData && "opacity-60")}>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    aria-label="Select all orders on this page"
                    checked={allOnPage}
                    onCheckedChange={(v) =>
                      setSelected(
                        v ? new Set(items.map((o) => o.id)) : new Set(),
                      )
                    }
                  />
                </TableHead>
                <SortHeader
                  label="Order"
                  column="number"
                  state={state}
                  onSort={onSort}
                />
                <SortHeader
                  label="Customer"
                  column="customer"
                  state={state}
                  onSort={onSort}
                />
                <TableHead>Status</TableHead>
                <SortHeader
                  label="Total"
                  column="total"
                  state={state}
                  onSort={onSort}
                  className="text-right"
                />
                <SortHeader
                  label="Created"
                  column="createdAt"
                  state={state}
                  onSort={onSort}
                />
                <TableHead className="w-12">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isPending ? (
                Array.from({ length: 8 }, (_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={7}>
                      <Skeleton className="h-6 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7}>
                    <EmptyState
                      title={
                        state.q || state.status
                          ? "No orders match these filters"
                          : "No orders yet"
                      }
                      action={
                        state.q || state.status ? (
                          <Button
                            variant="outline"
                            onClick={() => {
                              setSearch("");
                              update({ q: "", status: "" });
                            }}
                          >
                            Clear filters
                          </Button>
                        ) : undefined
                      }
                    />
                  </TableCell>
                </TableRow>
              ) : (
                items.map((o) => (
                  <TableRow
                    key={o.id}
                    data-state={selected.has(o.id) ? "selected" : undefined}
                  >
                    <TableCell>
                      <Checkbox
                        aria-label={`Select order #${o.number}`}
                        checked={selected.has(o.id)}
                        onCheckedChange={(v) =>
                          setSelected((prev) => {
                            const next = new Set(prev);
                            if (v) next.add(o.id);
                            else next.delete(o.id);
                            return next;
                          })
                        }
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      <Link to={`/orders/${o.id}`} className="hover:underline">
                        #{o.number}
                      </Link>
                    </TableCell>
                    <TableCell className="max-w-[16rem] truncate">
                      {o.customer}
                    </TableCell>
                    <TableCell>
                      <StatusBadge
                        tone={
                          o.status === "cancelled"
                            ? "danger"
                            : o.status === "shipped"
                              ? "success"
                              : "neutral"
                        }
                      >
                        {o.status}
                      </StatusBadge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {money.format(o.total / 100)}
                    </TableCell>
                    <TableCell>{date.format(new Date(o.createdAt))}</TableCell>
                    <TableCell>
                      <OrderRowActions order={o} />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <div className="flex flex-col items-center justify-between gap-3 text-sm sm:flex-row">
        <p className="text-muted-foreground">
          {data ? `Showing ${from}-${to} of ${data.total}` : " "}
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={state.page <= 1}
            onClick={() =>
              update({ page: state.page - 1 }, { resetPage: false })
            }
          >
            Previous
          </Button>
          <span>
            Page {state.page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={isPlaceholderData || state.page >= totalPages}
            onClick={() =>
              update({ page: state.page + 1 }, { resetPage: false })
            }
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
```

Status labels shown to users should be translated display strings, not raw
enum values; keep a `STATUS_LABEL` map.

## 4. Row actions with confirmation

```tsx
function OrderRowActions({ order }: { order: Order }) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const cancel = useCancelOrder();
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Actions for order #${order.number}`}
          >
            <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link to={`/orders/${order.id}/edit`}>Edit</Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-destructive"
            onSelect={() => setConfirmOpen(true)}
          >
            Cancel order
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel order #{order.number}?</AlertDialogTitle>
            <AlertDialogDescription>
              The customer will be notified. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep order</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() =>
                cancel.mutate(order.id, {
                  onSuccess: () =>
                    toast.success(`Order #${order.number} cancelled`),
                })
              }
            >
              Cancel order
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
```

## 5. API route (local Postgres, Nitro; same logic in a Next.js route handler)

```ts
// server/routes/api/orders.get.ts
import { defineHandler } from "nitro";
import { getQuery } from "nitro/h3";
import { getDb } from "../../utils/db";

const SORTS: Record<string, string> = {
  number: "number",
  customer: "customer_name",
  total: "total_cents",
  createdAt: "created_at",
};
const STATUSES = new Set(["pending", "paid", "shipped", "cancelled"]);

export default defineHandler(async (event) => {
  const q = getQuery(event);
  const sort = SORTS[String(q.sort)] ?? "created_at";
  const dir = q.dir === "asc" ? "ASC" : "DESC";
  const pageSize = Math.min(100, Math.max(1, Number(q.pageSize) || 20));
  const page = Math.max(1, Number(q.page) || 1);
  const where: string[] = ["deleted_at IS NULL"];
  const args: unknown[] = [];
  if (typeof q.q === "string" && q.q.trim()) {
    args.push(`%${q.q.trim()}%`);
    where.push(
      `(customer_name ILIKE $${args.length} OR number::text ILIKE $${args.length})`,
    );
  }
  if (typeof q.status === "string" && STATUSES.has(q.status)) {
    args.push(q.status);
    where.push(`status = $${args.length}`);
  }
  const whereSql = where.join(" AND ");
  const db = getDb();
  const [
    { rows: items },
    {
      rows: [{ count }],
    },
  ] = await Promise.all([
    db.query(
      `SELECT id, number, customer_name AS customer, total_cents AS total, status, created_at AS "createdAt"
         FROM orders WHERE ${whereSql} ORDER BY ${sort} ${dir}, id ${dir}
         LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`,
      args,
    ),
    db.query(
      `SELECT count(*)::int AS count FROM orders WHERE ${whereSql}`,
      args,
    ),
  ]);
  return { items, total: count };
});
```

Only whitelisted identifiers and computed integers are interpolated; every
user value is a `$n` parameter. Add an index matching the default sort
(`CREATE INDEX ON orders (created_at DESC) WHERE deleted_at IS NULL`) and a
trigram index if search must be fast on large tables.

Supabase variant: `supabase.from("orders").select("*", { count: "exact" }).ilike("customer_name", `%${q}%`).order(sortColumn, { ascending }).range(from, to)`,
with RLS policies limiting rows to staff roles.

## 6. Bulk endpoint contract

`POST /api/orders/bulk { ids: string[] (max 100), status }` →
`{ updated: number, skipped: [{ id, reason }] }`. Validate with zod, check the
user's role, update in one statement with a guard
(`WHERE id = ANY($1) AND status <> 'cancelled'`) and report skipped rows.
