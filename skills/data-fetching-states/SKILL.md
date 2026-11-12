---
slug: data-fetching-states
name: Data fetching states
version: 1.0.0
description: TanStack Query patterns for React apps covering query keys, loading skeletons, empty and error states, retries, mutations with invalidation, optimistic updates and pagination.
when_to_use: When a component reads or writes server data (API routes, Supabase, Neon, local Postgres), when screens flash, show stale data or spin forever, or when adding create, update and delete actions.
tags: [data, tanstack-query, react-query, loading, ux]
roles: [frontend-developer, backend-developer]
license: MIT
references:
  - file: references/optimistic-and-pagination.md
    description: Optimistic updates with rollback, paginated and infinite lists, prefetching, polling, dependent queries and Supabase/Next.js specifics.
---

# Data fetching states

KODRA apps use TanStack Query v5 (`QueryClientProvider` is already set up in
`src/App.tsx`). Every piece of server data goes through `useQuery` /
`useMutation`; don't `useEffect` + `useState` fetch.

## Structure

```
src/lib/api.ts            # fetchJson helper + typed API functions
src/hooks/use-<entity>.ts # query keys + hooks per entity
```

```ts
// src/lib/api.ts
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public body?: unknown,
  ) {
    super(message);
  }
}

export async function fetchJson<T>(
  input: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(input, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const body = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    const message =
      (body as { error?: string } | null)?.error ??
      `Request failed (${res.status})`;
    throw new ApiError(res.status, message, body);
  }
  return body as T;
}
```

```ts
// src/hooks/use-projects.ts
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { fetchJson } from "@/lib/api";

export type Project = {
  id: string;
  name: string;
  status: "active" | "archived";
  updatedAt: string;
};
export type ProjectFilters = {
  search?: string;
  status?: Project["status"];
  page?: number;
};

export const projectKeys = {
  all: ["projects"] as const,
  list: (filters: ProjectFilters) =>
    [...projectKeys.all, "list", filters] as const,
  detail: (id: string) => [...projectKeys.all, "detail", id] as const,
};

export function useProjects(filters: ProjectFilters) {
  const params = new URLSearchParams();
  if (filters.search) params.set("search", filters.search);
  if (filters.status) params.set("status", filters.status);
  params.set("page", String(filters.page ?? 1));
  return useQuery({
    queryKey: projectKeys.list(filters),
    queryFn: () =>
      fetchJson<{ items: Project[]; total: number }>(`/api/projects?${params}`),
    placeholderData: keepPreviousData,
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string }) =>
      fetchJson<Project>("/api/projects", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: projectKeys.all }),
  });
}
```

Key rules: keys are arrays starting with the entity, and include **every**
input the query function uses (filters, page, id). Invalidate by prefix
(`projectKeys.all`) after mutations.

## The four states, every time

```tsx
function ProjectList({ filters }: { filters: ProjectFilters }) {
  const { data, isPending, isError, error, refetch, isFetching } =
    useProjects(filters);

  if (isPending) return <ProjectListSkeleton />;
  if (isError) {
    return (
      <Notice tone="danger" title="Couldn't load projects">
        <p>{error.message}</p>
        <Button
          variant="outline"
          size="sm"
          className="mt-3"
          onClick={() => refetch()}
        >
          Try again
        </Button>
      </Notice>
    );
  }
  if (data.items.length === 0) {
    return filters.search || filters.status ? (
      <EmptyState
        title="No projects match these filters"
        action={
          <Button variant="outline" onClick={clearFilters}>
            Clear filters
          </Button>
        }
      />
    ) : (
      <EmptyState
        title="No projects yet"
        description="Create your first project to start tracking work."
        action={<Button onClick={openCreate}>New project</Button>}
      />
    );
  }
  return (
    <div
      aria-busy={isFetching}
      className={cn(isFetching && "opacity-70 transition-opacity")}
    >
      {data.items.map((p) => (
        <ProjectRow key={p.id} project={p} />
      ))}
    </div>
  );
}
```

(`Notice` and `EmptyState` are scaffold blocks in `src/components/app/`; check
their props before use, or build the same with shadcn `Alert`.)

- **Loading:** skeletons shaped like the content (`Skeleton` from shadcn),
  not a full-page spinner. Keep the page header and filters rendered.
- **Error:** human message + retry button; keep previously loaded data visible
  when a refetch fails (`isError && data` means stale data is still usable).
- **Empty:** distinguish "nothing yet" (invite the first action) from "no
  results for filters" (offer to clear them).
- **Success with background refetch:** subtle indicator (`isFetching`),
  never replace content with a skeleton.

`isPending` is true only when there is no data yet. Use `isLoading`
(`isPending && isFetching`) when a query can be disabled with `enabled: false`;
a disabled query stays `isPending` forever.

## Mutations

```tsx
const createProject = useCreateProject();

<Button
  disabled={createProject.isPending}
  onClick={() =>
    createProject.mutate(
      { name },
      {
        onSuccess: (project) => {
          toast.success(`Created ${project.name}`);
          navigate(`/projects/${project.id}`);
        },
        onError: (err) => toast.error(err.message),
      },
    )
  }
>
  {createProject.isPending ? "Creating..." : "Create project"}
</Button>;
```

- Disable the trigger while `isPending`; show progress in the label.
- Show the outcome: toast on success, toast or inline error on failure.
- After success, invalidate (or `setQueryData` with the server response)
  so lists update without a reload.
- Destructive actions: confirm with `AlertDialog`, or do it immediately with
  an "Undo" toast action.
- Optimistic updates for fast, likely-to-succeed actions (toggles, reorder,
  like): see `references/optimistic-and-pagination.md`.

## Defaults worth setting

```ts
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000, // avoid refetch storms on every mount
      retry: (count, error) =>
        !(error instanceof ApiError && error.status < 500) && count < 2,
      refetchOnWindowFocus: true,
    },
  },
});
```

Don't retry 4xx errors (validation, auth, not found); they won't fix themselves.
On 401, redirect to sign-in or show a "Session expired" notice.

## Anti-patterns

- `useEffect(() => { fetch(...).then(setState) }, [])` for server data.
- Query keys missing a variable (cache shows the wrong page or user).
- Copying query data into `useState` (it goes stale); derive instead.
- `refetch()` after mutations instead of invalidating the right keys.
- Infinite spinners: every loading state must end in data, empty or error.
- Calling the database directly from browser code with a server-only URL.
  Server data comes through API routes, server functions or the provider's
  client SDK with RLS (Supabase).

## Checklist

- [ ] Every query has loading (skeleton), error (retry) and empty states.
- [ ] Keys include all inputs; filters/page live in the URL when shareable (`useSearchParams`).
- [ ] Mutations disable their trigger, report success/failure and invalidate.
- [ ] Lists keep previous data while paging (`placeholderData: keepPreviousData`).
- [ ] No 4xx retries; auth errors handled.
