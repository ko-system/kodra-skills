# Optimistic updates, pagination and other patterns

## Optimistic update with rollback

Use for small, likely-to-succeed changes: toggles, ratings, reordering,
renames. Not for payments, irreversible deletes or anything the server may
reject often.

```ts
export function useToggleTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (task: { id: string; done: boolean }) =>
      fetchJson<Task>(`/api/tasks/${task.id}`, {
        method: "PATCH",
        body: JSON.stringify({ done: task.done }),
      }),
    onMutate: async (task) => {
      await queryClient.cancelQueries({ queryKey: taskKeys.all });
      const snapshots = queryClient.getQueriesData<Task[]>({
        queryKey: taskKeys.all,
      });
      queryClient.setQueriesData<Task[]>({ queryKey: taskKeys.all }, (old) =>
        Array.isArray(old)
          ? old.map((t) => (t.id === task.id ? { ...t, done: task.done } : t))
          : old,
      );
      return { snapshots };
    },
    onError: (_err, _task, context) => {
      for (const [key, data] of context?.snapshots ?? [])
        queryClient.setQueryData(key, data);
      toast.error("Couldn't update the task. Your change was undone.");
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: taskKeys.all }),
  });
}
```

Steps: cancel in-flight queries, snapshot, update cache, roll back on error,
always re-sync on settle. Update every cached list that contains the item
(`setQueriesData` with a prefix) or the UI will disagree between pages.

Simpler alternative for a single screen: render `mutation.variables` while
`mutation.isPending` (TanStack Query v5 "optimistic UI via variables"):

```tsx
{
  todos.map((t) => <TodoRow key={t.id} todo={t} />);
}
{
  addTodo.isPending && (
    <TodoRow
      todo={{ id: "pending", title: addTodo.variables.title }}
      className="opacity-60"
    />
  );
}
```

## Delete with undo

```ts
onMutate: async (id) => {
  await queryClient.cancelQueries({ queryKey: keys.all });
  const snapshots = queryClient.getQueriesData<Item[]>({ queryKey: keys.all });
  queryClient.setQueriesData<Item[]>({ queryKey: keys.all }, (old) => old?.filter((i) => i.id !== id));
  return { snapshots };
},
```

For a real undo, delay the server call: show `toast("Deleted", { action: { label: "Undo", onClick: cancel } })`,
and only call the API when the toast closes without undo. Or soft-delete on
the server (`deleted_at`) and expose a restore endpoint.

## Offset pagination (tables, admin lists)

```tsx
const [searchParams, setSearchParams] = useSearchParams();
const page = Number(searchParams.get("page") ?? "1");
const { data, isPending, isPlaceholderData } = useProjects({ page });
const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

<Button variant="outline" disabled={page <= 1} onClick={() => setSearchParams({ page: String(page - 1) })}>Previous</Button>
<span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
<Button variant="outline" disabled={isPlaceholderData || page >= totalPages} onClick={() => setSearchParams({ page: String(page + 1) })}>Next</Button>
```

Keep page and filters in the URL so refresh and sharing work.
`keepPreviousData` keeps the old page visible while the next loads; dim it
with `isPlaceholderData`. Prefetch the next page:

```ts
useEffect(() => {
  if (data && page < totalPages) {
    queryClient.prefetchQuery({
      queryKey: projectKeys.list({ page: page + 1 }),
      queryFn: () => getProjects({ page: page + 1 }),
    });
  }
}, [data, page, totalPages, queryClient]);
```

## Infinite list (feeds, activity, chat history)

```ts
const query = useInfiniteQuery({
  queryKey: ["activity"],
  queryFn: ({ pageParam }) =>
    fetchJson<{ items: Activity[]; nextCursor: string | null }>(
      `/api/activity?cursor=${pageParam ?? ""}`,
    ),
  initialPageParam: null as string | null,
  getNextPageParam: (last) => last.nextCursor,
});
const items = query.data?.pages.flatMap((p) => p.items) ?? [];
```

Use cursor pagination on the server (`WHERE created_at < $cursor ORDER BY
created_at DESC LIMIT 20`). Provide a visible "Load more" button
(`query.fetchNextPage()`, disabled while `isFetchingNextPage`); auto-loading
with an IntersectionObserver is optional on top of it.

## Dependent queries

```ts
const { data: user } = useQuery({ queryKey: ["me"], queryFn: getMe });
const { data: orders } = useQuery({
  queryKey: ["orders", user?.id],
  queryFn: () => getOrders(user!.id),
  enabled: !!user,
});
```

## Search as you type

Debounce the input (300 ms) and put the debounced value in the key. Show
results for the last completed search while the new one loads
(`placeholderData: keepPreviousData`). Ignore queries shorter than 2 chars
with `enabled`.

```ts
function useDebounced<T>(value: T, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}
```

## Polling and freshness

- `refetchInterval: 5000` for job status; stop when done:
  `refetchInterval: (query) => (query.state.data?.status === "done" ? false : 5000)`.
- `staleTime: Infinity` for data that never changes in a session (country
  lists, plans); `staleTime: 0` for things users expect to be live.

## Supabase client

```ts
const { data, error } = await supabase
  .from("projects")
  .select("id, name, status")
  .order("updated_at", { ascending: false })
  .range(from, to);
if (error) throw error; // make the query function throw so TanStack Query sees the error
return data;
```

Always throw on `error`; returning `null` hides failures as "empty". Realtime
subscriptions should call `queryClient.invalidateQueries` (or
`setQueryData`) rather than keeping their own state.

## Next.js App Router

- Server Components can fetch directly (database or API) and pass data as
  props; use TanStack Query in Client Components for interactive data
  (filters, mutations, polling).
- To avoid a loading flash, prefetch on the server and hydrate:
  `const qc = new QueryClient(); await qc.prefetchQuery(...)` then wrap the
  client tree in `<HydrationBoundary state={dehydrate(qc)}>`.
- Mutations can call Server Actions; still invalidate the related query keys
  (or `router.refresh()` for server-rendered data).
