---
slug: qa-smoke-tests
name: QA smoke tests
version: 1.0.0
description: Small, reliable Playwright smoke tests for generated apps that cover page loads, navigation, the main create/read/update flow, form validation and auth gates, run with run_tests.
when_to_use: After building or changing a feature, before publishing, when the owner asks for tests or QA, or when a bug was fixed and needs a regression check.
tags: [testing, qa, playwright, e2e, smoke]
roles: [qa-tester, frontend-developer]
license: MIT
references:
  - file: references/spec-templates.md
    description: Copy-ready smoke spec templates (routes, navigation, CRUD, forms, auth, responsive, console errors) and a flake-fixing guide.
---

# QA smoke tests

A smoke suite answers one question fast: "Is anything important obviously
broken?" Keep it to a handful of specs that each prove one user flow works
end to end. Run them with the `run_tests` tool.

## KODRA test conventions (follow exactly)

- Specs live in `e2e-tests/` and are named after the flow:
  `e2e-tests/smoke.spec.ts`, `e2e-tests/create-booking.spec.ts`.
- Import from `@playwright/test`: `import { test, expect } from "@playwright/test";`
- Do **not** create or edit `playwright-dyad.config.ts`, `e2e-tests/tsconfig.json`
  or anything in `e2e-tests/fixtures/dyad/`; KODRA generates them. The base URL
  is configured for you: navigate with app-relative paths (`page.goto("/")`).
- Your own reusable helpers go in `e2e-tests/fixtures/` (e.g.
  `e2e-tests/fixtures/bookings.ts`).
- If `e2e-tests/fixtures/test-user.ts` exists, reuse its `signIn(page)`.
  Otherwise read `process.env.DYAD_TEST_USER_EMAIL` / `DYAD_TEST_USER_PASSWORD`
  inside the test (never at module scope) when KODRA provides them.
- Seed data through the app's UI or its own API routes, inside each test.
  Never connect to the database from a test. Assume an empty database for
  managed providers (each test gets isolated data).

## What to cover (in priority order)

1. **Every public route renders:** status OK, the main heading visible, no
   uncaught page errors.
2. **Primary flow:** the one thing the app exists for (create a booking, add
   to cart, post a note), asserting the visible result.
3. **Navigation:** header links reach their pages; 404 page for an unknown URL.
4. **Form validation:** submitting empty shows errors; valid input succeeds.
5. **Auth gate** (if the app has auth): signed-out users are redirected from
   private pages; a signed-in user sees their data.
6. **Mobile smoke:** the primary page at 375px has no horizontal scroll and
   the main CTA is visible.

Skip exhaustive edge cases, visual pixel comparisons and third-party flows
(payments, OAuth providers, email delivery): mock or stop at the boundary.

## Writing reliable tests

- Read the page and component code first; use the real labels, roles and
  routes. Don't guess selectors.
- Locators by role and label: `getByRole("button", { name: "Save changes" })`,
  `getByLabel("Email")`, `getByRole("heading", { name: "Bookings" })`. Use
  `getByTestId` only for elements without accessible names; add
  `data-testid` to the component if needed.
- Use web-first assertions that wait automatically:
  `await expect(locator).toBeVisible()`, `toHaveText`, `toHaveURL`,
  `toHaveCount`. Never `waitForTimeout`.
- Make test data unique per run: ``const name = `Smoke ${Date.now()}`;`` then
  assert on that exact name.
- One flow per test, short and readable; `test.step` for long flows.
- Tests must pass against the real app as built. If a test exposes a real
  bug, fix the app (or report it), not the assertion.

## Minimal smoke spec

```ts
// e2e-tests/smoke.spec.ts
import { test, expect } from "@playwright/test";

const ROUTES = [
  { path: "/", heading: /book a table/i },
  { path: "/menu", heading: /menu/i },
  { path: "/contact", heading: /contact/i },
];

for (const route of ROUTES) {
  test(`renders ${route.path}`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));
    await page.goto(route.path);
    await expect(
      page.getByRole("heading", { level: 1, name: route.heading }),
    ).toBeVisible();
    expect(errors).toEqual([]);
  });
}

test("unknown route shows the not-found page", async ({ page }) => {
  await page.goto("/this-page-does-not-exist");
  await expect(page.getByText(/page not found/i)).toBeVisible();
});
```

## Running and iterating

1. Write or update specs, then call `run_tests` with the affected files
   (`testFiles: ["e2e-tests/smoke.spec.ts"]`).
2. On failure, read `test-results/<test>/error-context.md` (accessibility
   snapshot of the page at failure) before changing anything. Decide whether
   the test expectation or the app is wrong.
3. Fix the real cause, rerun only the failing files. Use `flakeCheck: true`
   once if you suspect flakiness rather than rerunning blindly.
4. Report: which flows are covered, pass/fail, and bugs found.

## Done checklist

- [ ] Smoke spec covering all public routes and the 404 page.
- [ ] One spec for the primary flow, seeding its own data.
- [ ] Form validation and auth gate covered when they exist.
- [ ] No sleeps, no CSS/XPath selectors where a role or label exists.
- [ ] All specs pass with `run_tests`; failures investigated via error-context.md.
