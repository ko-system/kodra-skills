# Checkout server routes

Shared pieces first, then the framework-specific routes. Database access uses
the app's `getDb()` helper (local Postgres / Neon pattern) and the `products`,
`orders`, `order_items` tables from the database-schema-design skill. Adapt
to Supabase queries or drizzle if the app uses them.

## Shared: request schema and line item builder

```ts
// lib/checkout.ts (Next.js) or server/utils/checkout.ts (Nitro)
import { z } from "zod";
import type Stripe from "stripe";

export const checkoutSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        quantity: z.number().int().min(1).max(99),
      }),
    )
    .min(1)
    .max(50),
  email: z.string().email().optional(),
});

type ProductRow = {
  id: string;
  name: string;
  price_cents: number;
  currency: string;
  stock: number;
  is_active: boolean;
};

export function buildLineItems(
  items: { productId: string; quantity: number }[],
  products: ProductRow[],
): {
  lineItems: Stripe.Checkout.SessionCreateParams.LineItem[];
  subtotal: number;
  error?: string;
} {
  const byId = new Map(products.map((p) => [p.id, p]));
  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];
  let subtotal = 0;
  for (const item of items) {
    const product = byId.get(item.productId);
    if (!product || !product.is_active)
      return {
        lineItems: [],
        subtotal: 0,
        error: "A product in your cart is no longer available.",
      };
    if (product.stock < item.quantity)
      return {
        lineItems: [],
        subtotal: 0,
        error: `Only ${product.stock} of ${product.name} left.`,
      };
    subtotal += product.price_cents * item.quantity;
    lineItems.push({
      quantity: item.quantity,
      price_data: {
        currency: product.currency.toLowerCase(),
        unit_amount: product.price_cents,
        product_data: {
          name: product.name,
          metadata: { productId: product.id },
        },
      },
    });
  }
  return { lineItems, subtotal };
}
```

Create the Stripe client lazily on the server:
`new Stripe(process.env.STRIPE_SECRET_KEY!)`, and fail with a clear 500
message ("Payments are not configured") when the variable is missing.

<nextjs-only>
## Next.js route handlers

```ts
// app/api/checkout/route.ts
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getDb } from "@/lib/db";
import { buildLineItems, checkoutSchema } from "@/lib/checkout";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key)
    return NextResponse.json(
      { error: "Payments are not configured" },
      { status: 500 },
    );
  const parsed = checkoutSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: "Invalid cart" }, { status: 422 });

  const db = getDb();
  const ids = parsed.data.items.map((i) => i.productId);
  const { rows: products } = await db.query(
    "SELECT id, name, price_cents, currency, stock, is_active FROM products WHERE id = ANY($1)",
    [ids],
  );
  const { lineItems, subtotal, error } = buildLineItems(
    parsed.data.items,
    products,
  );
  if (error) return NextResponse.json({ error }, { status: 409 });

  const client = await db.connect();
  let orderId: string;
  try {
    await client.query("BEGIN");
    const {
      rows: [order],
    } = await client.query(
      "INSERT INTO orders (email, status, subtotal_cents, total_cents, currency) VALUES ($1, 'pending', $2, $2, 'THB') RETURNING id",
      [parsed.data.email ?? "", subtotal],
    );
    orderId = order.id;
    for (const item of parsed.data.items) {
      const p = products.find((x: { id: string }) => x.id === item.productId)!;
      await client.query(
        "INSERT INTO order_items (order_id, product_id, product_name, unit_price_cents, quantity) VALUES ($1, $2, $3, $4, $5)",
        [orderId, p.id, p.name, p.price_cents, item.quantity],
      );
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }

  const origin = new URL(req.url).origin;
  const stripe = new Stripe(key);
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: lineItems,
    client_reference_id: orderId,
    metadata: { orderId },
    customer_email: parsed.data.email,
    success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/cart`,
  });
  await db.query("UPDATE orders SET payment_provider_ref = $1 WHERE id = $2", [
    session.id,
    orderId,
  ]);
  return NextResponse.json({ url: session.url });
}
```

```ts
// app/api/stripe/webhook/route.ts
import Stripe from "stripe";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const key = process.env.STRIPE_SECRET_KEY;
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = req.headers.get("stripe-signature");
  if (!key || !secret || !signature)
    return new Response("Not configured", { status: 400 });

  const stripe = new Stripe(key);
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(await req.text(), signature, secret);
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }
  await handleStripeEvent(event);
  return new Response("ok");
}
```

`handleStripeEvent` is shared (see below). The webhook route must receive the
raw body: never call `req.json()` before verifying.
</nextjs-only>

<vite-nitro-only>
## Nitro routes (Vite + Nitro)

```ts
// server/routes/api/checkout.post.ts
import Stripe from "stripe";
import { defineHandler } from "nitro";
import { createError, getRequestURL, readBody } from "nitro/h3";
import { getDb } from "../../utils/db";
import { buildLineItems, checkoutSchema } from "../../utils/checkout";

export default defineHandler(async (event) => {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key)
    throw createError({
      statusCode: 500,
      statusMessage: "Payments are not configured",
    });
  const parsed = checkoutSchema.safeParse(await readBody(event));
  if (!parsed.success)
    throw createError({ statusCode: 422, statusMessage: "Invalid cart" });

  const db = getDb();
  const { rows: products } = await db.query(
    "SELECT id, name, price_cents, currency, stock, is_active FROM products WHERE id = ANY($1)",
    [parsed.data.items.map((i) => i.productId)],
  );
  const { lineItems, subtotal, error } = buildLineItems(
    parsed.data.items,
    products,
  );
  if (error) throw createError({ statusCode: 409, statusMessage: error });

  const orderId = await createPendingOrder(db, parsed.data, products, subtotal); // same transaction as the Next.js example
  const origin = getRequestURL(event).origin;
  const stripe = new Stripe(key);
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: lineItems,
    client_reference_id: orderId,
    metadata: { orderId },
    customer_email: parsed.data.email,
    success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/cart`,
  });
  await db.query("UPDATE orders SET payment_provider_ref = $1 WHERE id = $2", [
    session.id,
    orderId,
  ]);
  return { url: session.url };
});
```

```ts
// server/routes/api/stripe/webhook.post.ts
import Stripe from "stripe";
import { defineHandler } from "nitro";
import { createError, getRequestHeaders, readRawBody } from "nitro/h3";
import { handleStripeEvent } from "../../../utils/stripe-events";

export default defineHandler(async (event) => {
  const key = process.env.STRIPE_SECRET_KEY;
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = getRequestHeaders(event)["stripe-signature"];
  const raw = await readRawBody(event, "utf8");
  if (!key || !secret || !signature || !raw)
    throw createError({ statusCode: 400, statusMessage: "Bad request" });

  let stripeEvent: Stripe.Event;
  try {
    stripeEvent = new Stripe(key).webhooks.constructEvent(
      raw,
      signature,
      secret,
    );
  } catch {
    throw createError({ statusCode: 400, statusMessage: "Invalid signature" });
  }
  await handleStripeEvent(stripeEvent);
  return "ok";
});
```

Supabase Edge Function variant: same logic in Deno with
`import Stripe from "npm:stripe"`, read `await req.text()`, and verify with
`await stripe.webhooks.constructEventAsync(body, signature, secret)`.
</vite-nitro-only>

## Shared: webhook event handler (idempotent)

```ts
export async function handleStripeEvent(event: Stripe.Event) {
  const db = getDb();
  if (
    event.type === "checkout.session.completed" ||
    event.type === "checkout.session.async_payment_succeeded"
  ) {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.payment_status !== "paid") return; // async methods confirm later
    const orderId = session.metadata?.orderId;
    if (!orderId) return;
    const client = await db.connect();
    try {
      await client.query("BEGIN");
      const { rowCount } = await client.query(
        "UPDATE orders SET status = 'paid', paid_at = now(), email = COALESCE(NULLIF(email, ''), $2) WHERE id = $1 AND status = 'pending'",
        [orderId, session.customer_details?.email ?? ""],
      );
      if (rowCount === 1) {
        await client.query(
          "UPDATE products p SET stock = p.stock - oi.quantity FROM order_items oi WHERE oi.order_id = $1 AND oi.product_id = p.id",
          [orderId],
        );
      }
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e; // non-2xx makes Stripe retry
    } finally {
      client.release();
    }
  } else if (event.type === "checkout.session.expired") {
    const orderId = (event.data.object as Stripe.Checkout.Session).metadata
      ?.orderId;
    if (orderId)
      await db.query(
        "UPDATE orders SET status = 'cancelled' WHERE id = $1 AND status = 'pending'",
        [orderId],
      );
  }
}
```

`rowCount === 1` makes duplicate deliveries harmless: only the first one
decrements stock. Send receipts or notifications after the commit, and make
them idempotent too.

## Order lookup for the success page

`GET /api/orders/by-session?session_id=cs_...` returns only
`{ number, status, totalCents, currency, items: [{ name, quantity }] }`
for the order whose `payment_provider_ref` equals the session ID. Validate the
format (`^cs_(test|live)_[A-Za-z0-9]+$`) and never return other customers'
personal data.

## Testing locally

1. Use Stripe test-mode keys in the development environment.
2. Forward webhooks with the Stripe CLI (`stripe listen --forward-to
localhost:<port>/api/stripe/webhook`) on the owner's machine; it prints the
   `whsec_...` secret to use as `STRIPE_WEBHOOK_SECRET` in development.
3. Pay with `4242 4242 4242 4242`, any future date, any CVC; confirm the
   order becomes `paid` exactly once even if you resend the event
   (`stripe events resend <id>`).
4. Try a declined card and the cancel button; the order stays `pending` and
   later expires.
