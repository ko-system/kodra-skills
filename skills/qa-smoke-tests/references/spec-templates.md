# Smoke spec templates

Replace names, routes and labels with what the app actually renders (read
the components first). All specs import from `@playwright/test` and use
app-relative URLs.

## Header navigation

```ts
// e2e-tests/navigation.spec.ts
import { test, expect } from "@playwright/test";

test("header links reach their pages", async ({ page }) => {
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Main" });
  for (const [label, url, heading] of [
    ["Menu", /\/menu$/, /menu/i],
    ["Contact", /\/contact$/, /contact/i],
  ] as const) {
    await nav.getByRole("link", { name: label }).click();
    await expect(page).toHaveURL(url);
    await expect(
      page.getByRole("heading", { level: 1, name: heading }),
    ).toBeVisible();
  }
});
```

On mobile layouts the links are inside a menu: open it first with
`page.getByRole("button", { name: "Open menu" })`.

## Create, read, update, delete

```ts
// e2e-tests/projects.spec.ts
import { test, expect } from "@playwright/test";

test("create, rename and delete a project", async ({ page }) => {
  const name = `Smoke project ${Date.now()}`;
  const renamed = `${name} (renamed)`;

  await test.step("create", async () => {
    await page.goto("/projects");
    await page.getByRole("button", { name: "New project" }).click();
    await page.getByLabel("Project name").fill(name);
    await page.getByRole("button", { name: "Create project" }).click();
    await expect(page.getByText(`Created ${name}`)).toBeVisible();
    await expect(page.getByRole("link", { name })).toBeVisible();
  });

  await test.step("rename", async () => {
    await page.getByRole("button", { name: `Actions for ${name}` }).click();
    await page.getByRole("menuitem", { name: "Edit" }).click();
    await page.getByLabel("Project name").fill(renamed);
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByRole("link", { name: renamed })).toBeVisible();
  });

  await test.step("delete", async () => {
    await page.getByRole("button", { name: `Actions for ${renamed}` }).click();
    await page.getByRole("menuitem", { name: "Delete" }).click();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Delete project" })
      .click();
    await expect(page.getByRole("link", { name: renamed })).toHaveCount(0);
  });
});
```

## Form validation

```ts
// e2e-tests/contact-form.spec.ts
import { test, expect } from "@playwright/test";

test("contact form validates and submits", async ({ page }) => {
  await page.goto("/contact");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByText("Enter your full name")).toBeVisible();

  await page.getByLabel("Full name").fill("Somchai Jaidee");
  await page.getByLabel("Email").fill("somchai@example.com");
  await page
    .getByLabel("Message")
    .fill("I'd like to book a table for six on Friday.");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByText(/message sent/i)).toBeVisible();
});
```

Assert the app's real messages (copy them from the zod schema or component).

## Auth gate and signed-in view

```ts
// e2e-tests/auth.spec.ts
import { test, expect } from "@playwright/test";
import { signIn } from "./fixtures/test-user";

test("signed-out visitors are sent to sign in", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/(login|sign-in)/);
});

test("signed-in user reaches the dashboard", async ({ page }) => {
  await signIn(page);
  await page.goto("/dashboard");
  await expect(
    page.getByRole("heading", { level: 1, name: /dashboard/i }),
  ).toBeVisible();
});
```

Only add auth tests when the flow needs a signed-in user and the app has
sign-in. Read credentials inside helpers or tests, never at module scope.

## Seeding through the app's API

```ts
// e2e-tests/fixtures/projects.ts
import type { Page } from "@playwright/test";

export async function createProject(page: Page, name: string) {
  const response = await page.request.post("/api/projects", { data: { name } });
  if (!response.ok()) throw new Error(`Seeding failed: ${response.status()}`);
  return (await response.json()) as { id: string; name: string };
}
```

Use API seeding when the UI path is slow or not under test. If the API
requires auth cookies, sign in with `page` first so `page.request` shares them.

## Mobile smoke

```ts
// e2e-tests/mobile.spec.ts
import { test, expect } from "@playwright/test";

test.use({ viewport: { width: 375, height: 740 } });

test("home page fits a phone screen", async ({ page }) => {
  await page.goto("/");
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  await expect(
    page.getByRole("link", { name: "Book a table" }).first(),
  ).toBeInViewport();
});
```

## Console and network errors

```ts
test("home page loads without errors", async ({ page }) => {
  const problems: string[] = [];
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") problems.push(`console: ${m.text()}`);
  });
  page.on("response", (r) => {
    if (r.url().includes("/api/") && r.status() >= 500)
      problems.push(`${r.status()} ${r.url()}`);
  });
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  expect(problems).toEqual([]);
});
```

## Stopping at third-party boundaries

- Payments: assert the app requested a checkout session and attempted the
  redirect, without completing payment:
  ```ts
  const [request] = await Promise.all([
    page.waitForRequest(
      (r) => r.url().endsWith("/api/checkout") && r.method() === "POST",
    ),
    page.getByRole("button", { name: /pay/i }).click(),
  ]);
  expect(request.postDataJSON().items.length).toBeGreaterThan(0);
  ```
- Email: assert the UI confirmation, not delivery.
- Maps and embeds: assert the container is visible.

## Fixing flaky tests

| Symptom                                  | Fix                                                                                                                  |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Element not found right after navigation | Assert a heading first; use `expect(...).toBeVisible()`                                                              |
| Strict mode violation (2+ matches)       | Scope to a region or row (`row.getByRole(...)`), use `exact: true`, or `.first()` only for genuinely identical items |
| Passes alone, fails in suite             | Unique test data; don't depend on other tests' records                                                               |
| Animation intercepts click               | Wait for the dialog/menu to be visible before clicking inside                                                        |
| Timing on debounced search               | Assert the result list content, not a fixed delay                                                                    |
| Text differs by locale/date              | Assert with regex or set fixed data in the test                                                                      |
