---
slug: ecommerce-checkout
name: E-commerce checkout
version: 1.0.0
description: Cart state, server-priced Stripe Checkout redirects, verified webhooks, idempotent order states and success/cancel pages, without exposing secret keys or trusting client prices.
when_to_use: When adding a cart, buy button, checkout, payments, order history or order management to a store, booking or ticketing app, or when reviewing an existing checkout for security problems.
tags: [ecommerce, payments, stripe, cart, orders]
roles: [frontend-developer, backend-developer]
framework_sections: true
license: MIT
references:
  - file: references/server-routes.md
    description: Complete checkout-session and webhook route implementations for Next.js and Vite + Nitro, plus testing steps.
---

# E-commerce checkout

Use Stripe Checkout (hosted payment page) by redirect: the server creates a
Checkout Session and returns its URL; the browser navigates there; Stripe
calls your webhook when payment completes. This keeps card data and secret
keys off your app and supports cards, PromptPay and wallets for THB.

## Non-negotiable security rules

1. **Secret keys stay on the server.** `STRIPE_SECRET_KEY` and
   `STRIPE_WEBHOOK_SECRET` are server-only environment variables. Never
   `VITE_*` / `NEXT_PUBLIC_*`, never in client code, never committed. The
   owner adds them in the app's environment settings; don't ask them to paste
   keys into chat, and don't invent keys.
2. **The server decides prices.** The client sends only product IDs and
   quantities. The server loads prices from the database (or Stripe Price
   IDs), validates stock and quantity limits, and builds line items.
3. **The webhook is the source of truth.** An order becomes `paid` only from a
   signature-verified `checkout.session.completed` webhook (with
   `payment_status === "paid"`), never from the success page URL.
4. **Idempotency.** Webhooks can arrive twice or out of order. Update with a
   guard (`where id = $1 and status = 'pending'`) and store the Stripe
   session ID uniquely.
5. **Amounts in minor units** (satang/cents) as integers end to end. Stripe
   `unit_amount` for THB is in satang (฿590.00 = 59000). Stripe's minimum
   charge for THB is ฿10.

## Flow

```
Cart (client state) -> POST /api/checkout { items: [{ productId, quantity }] }
  server: validate -> load prices -> create pending order -> create Checkout Session
  <- { url }
window.location.assign(url) -> Stripe hosted page
  -> success_url /checkout/success?session_id={CHECKOUT_SESSION_ID}
  -> cancel_url  /cart
Stripe -> POST /api/stripe/webhook (checkout.session.completed)
  server: verify signature -> mark order paid (idempotent) -> decrement stock -> send receipt
Success page: GET /api/orders/by-session?session_id=... -> show status (poll until paid)
```

## Cart state

- Keep the cart client-side (React context or a small store) persisted to
  `localStorage`: `{ productId, quantity }[]` only. Prices shown in the cart
  come from fetched product data, not from storage.
- Clamp quantities (1-99 or stock), merge duplicate lines, and handle products
  that disappeared or changed price (re-fetch on the cart page and show a
  notice).
- Signed-in users: optionally sync the cart to a `carts` table.
- Clear the cart after a confirmed payment (on the success page once the
  order reads as paid).

```tsx
type CartLine = { productId: string; quantity: number };

function cartReducer(
  lines: CartLine[],
  action:
    | { type: "add"; productId: string; quantity?: number }
    | { type: "set"; productId: string; quantity: number }
    | { type: "remove"; productId: string }
    | { type: "clear" },
): CartLine[] {
  switch (action.type) {
    case "add": {
      const existing = lines.find((l) => l.productId === action.productId);
      const add = action.quantity ?? 1;
      return existing
        ? lines.map((l) =>
            l.productId === action.productId
              ? { ...l, quantity: Math.min(99, l.quantity + add) }
              : l,
          )
        : [
            ...lines,
            { productId: action.productId, quantity: Math.min(99, add) },
          ];
    }
    case "set":
      return action.quantity <= 0
        ? lines.filter((l) => l.productId !== action.productId)
        : lines.map((l) =>
            l.productId === action.productId
              ? { ...l, quantity: Math.min(99, action.quantity) }
              : l,
          );
    case "remove":
      return lines.filter((l) => l.productId !== action.productId);
    case "clear":
      return [];
  }
}
```

## Checkout button

```tsx
const checkout = useMutation({
  mutationFn: (items: CartLine[]) =>
    fetchJson<{ url: string }>("/api/checkout", {
      method: "POST",
      body: JSON.stringify({ items }),
    }),
  onSuccess: ({ url }) => window.location.assign(url),
  onError: (e) => toast.error(e.message),
});

<Button
  size="lg"
  className="w-full"
  disabled={lines.length === 0 || checkout.isPending}
  onClick={() => checkout.mutate(lines)}
>
  {checkout.isPending
    ? "Redirecting to payment..."
    : `Pay ${money.format(subtotal / 100)}`}
</Button>;
```

<vite-nitro-only>
## Where the server code goes (Vite)

Vite apps need a server layer for checkout. If the app has no `server/`
directory yet, enable the Nitro server layer first (KODRA's `enable_nitro`
tool, or `setup_local_database` when a database is also needed). Routes:
`server/api/checkout.post.ts`, `server/api/stripe/webhook.post.ts`,
`server/api/orders/by-session.get.ts`. Add `stripe` to dependencies. If
the app uses Supabase as its backend instead, implement the same two
endpoints as Supabase Edge Functions. Full code: `references/server-routes.md`.
</vite-nitro-only>

<nextjs-only>
## Where the server code goes (Next.js)

Route handlers: `app/api/checkout/route.ts`,
`app/api/stripe/webhook/route.ts` (read the raw body with `await req.text()`;
set `export const runtime = "nodejs"`), and
`app/api/orders/by-session/route.ts`. Add `stripe` to dependencies. A Server
Action can replace the checkout route if the button lives in a form. Full
code: `references/server-routes.md`.
</nextjs-only>

## Order states

`pending` (session created) -> `paid` (webhook) -> `fulfilled`/`shipped` ->
optionally `refunded`; `cancelled` for expired sessions
(`checkout.session.expired` webhook) or staff action. Show status to
customers with plain labels and timestamps; let staff change status in the
admin (crud-dashboard skill) with each change audited.

## Success and cancel pages

- Success: "Thanks! We're confirming your payment..." then poll the order by
  `session_id` every 2s for up to ~30s; show the order number, items, total
  and next steps when it reads `paid`. If it is still pending, say the
  receipt will arrive by email. `noindex` the page.
- Cancel: return to the cart with items intact and a neutral message
  ("Payment cancelled. Your cart is saved.").

## Before going live

- [ ] Test mode end to end with Stripe test cards (`4242 4242 4242 4242`), a
      declined card (`4000 0000 0000 0002`) and PromptPay test flow.
- [ ] Webhook endpoint registered in the Stripe dashboard for the production
      URL with `checkout.session.completed` and `checkout.session.expired`.
- [ ] Switch to live keys only in the production environment.
- [ ] Prices, currency, VAT/tax display and shipping costs confirmed by the owner.
- [ ] Refund and cancellation policy page linked from checkout.
- [ ] No secret in client bundles (search the built output for `sk_`).
