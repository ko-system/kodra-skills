# KODRA skills

Curated skills for the KODRA AI app builder. A skill is a small package of
reference guidance (and optionally read-only analysis scripts) that KODRA's
agents load on demand while they build React + Vite or Next.js apps.

The source of truth lives in the KODRABuilder repository under
`skill-catalog/`. The public `ko-system/kodra-skills` repository is a mirror
that is published by a workflow; do not edit it by hand.

## Layout

```
skills/<slug>/
  SKILL.md          # YAML frontmatter + markdown guidance (max 64 KB)
  references/*.md   # optional longer material, loaded on demand (max 64 KB each)
  scripts/*.js      # optional read-only MustardScript programs (max 128 KB each)
index.json          # catalog index: per-file sha256, sizes and package hashes
```

Every skill is versioned with semver. Any change to a skill's files requires a
version bump; the publish workflow rejects unbumped changes.

## Skills

| Skill                    | What it covers                                                          | Script                   |
| ------------------------ | ----------------------------------------------------------------------- | ------------------------ |
| `landing-page`           | Conversion pages with six narrative structures chosen by business/style | `audit_landing_sections` |
| `visual-design-craft`    | Design directions, detail checklist, critique rubric (DSH-adapted, MIT) |                          |
| `responsive-layout`      | Mobile-first breakpoints, fluid type, touch targets, container queries  | `find_fixed_widths`      |
| `accessibility-audit`    | WCAG 2.1 AA for React: alt text, labels, focus, contrast, keyboard      | `a11y_static_scan`       |
| `seo-metadata`           | Titles, meta, Open Graph, sitemap, robots, JSON-LD (Vite and Next.js)   | `check_meta`             |
| `forms-validation`       | react-hook-form + zod, inline errors, pending states, server errors     |                          |
| `data-fetching-states`   | TanStack Query: loading, empty and error states, optimistic updates     |                          |
| `crud-dashboard`         | Admin tables, filters, pagination, bulk actions, empty states           |                          |
| `database-schema-design` | Relational modelling, indexes, constraints, row-level security notes    |                          |
| `ecommerce-checkout`     | Cart state, Stripe Checkout redirect, order states, webhooks            |                          |
| `thai-localization`      | Thai typography, line breaking, Buddhist-era dates, THB, addresses, IDs, tax invoices, PDPA | `find_hardcoded_strings` |
| `thai-payments`          | PromptPay QR and Omise (Opn) card/PromptPay charges with verified webhooks |                          |
| `line-integration`       | LINE Login, LIFF and Messaging API bots with server-side verification   |                          |
| `performance-web-vitals` | LCP, CLS and INP: images, lazy loading, code splitting, fonts           | `find_large_assets`      |
| `qa-smoke-tests`         | Playwright smoke tests for generated apps                               |                          |

## Safety model

- Skills are reference guidance only. They cannot grant tools, change an
  agent's role or select models; unknown frontmatter keys are ignored.
- KODRA installs a skill only from this catalog's `index.json`, downloads files
  from a commit-pinned URL and verifies every file's sha256 before use.
- Scripts run in KODRA's MustardScript sandbox with read-only access to the
  current app (`read_file`, `list_files`, `file_stats`), no network and no
  writes. Users approve each skill version's scripts before the first run.

## License

MIT. See `LICENSE`.
