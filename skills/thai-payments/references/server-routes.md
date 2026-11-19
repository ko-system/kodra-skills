# Thai payment routes

The examples use the `orders` / `payments` tables from SKILL.md and a `pg`
pool (`getDb()` from `server/utils/db.ts`, as in KODRA's local Postgres
setup). Swap in the app's own data layer (Drizzle, Neon, Supabase client) but
keep the same checks and the `status = 'pending'` guards.

The routes are written for Vite + Nitro; the framework section at the end
shows how to adapt them (Next.js route handlers or Supabase Edge Functions).

## Shared payment logic (Vite + Nitro: `server/utils/payments.ts`)

```ts
import { getDb } from "./db";
import { confirmOmiseCharge, requireOmiseEnv } from "./thai/omise";

/** Re-checks a pending Omise payment and records the result. Idempotent. */
export async function syncOmisePayment(paymentId: string) {
  const db = getDb();
  const { rows } = await db.query(
    "select id, order_id, amount_satang, omise_charge_id, status from payments where id = $1",
    [paymentId],
  );
  const payment = rows[0];
  if (!payment) return null;
  if (payment.status !== "pending" || !payment.omise_charge_id) return payment.status;

  const result = await confirmOmiseCharge({
    secretKey: requireOmiseEnv("OMISE_SECRET_KEY"),
    chargeId: payment.omise_charge_id,
    expectedAmountSatang: payment.amount_satang,
    expectedOrderId: payment.order_id,
  });
  if (result.paid) {
    const client = await db.connect();
    try {
      await client.query("begin");
      const updated = await client.query(
        "update payments set status = 'successful' where id = $1 and status = 'pending'",
        [payment.id],
      );
      if (updated.rowCount === 1) {
        await client.query(
          "update orders set status = 'paid', paid_at = now() where id = $1 and status = 'awaiting_payment'",
          [payment.order_id],
        );
        // Send the receipt / LINE notification here, once.
      }
      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
    return "successful";
  }
  if (result.status === "failed" || result.status === "expired") {
    await db.query(
      "update payments set status = $2 where id = $1 and status = 'pending'",
      [payment.id, result.status],
    );
  }
  return result.status;
}
```

## Public config — `server/routes/api/thai/config.get.ts`

```ts
import { defineHandler } from "nitro";
import { getPublicOmiseConfig } from "../../../utils/thai/omise";

export default defineHandler(() => ({
  omise: getPublicOmiseConfig(),
  promptpay: { displayName: process.env.PROMPTPAY_DISPLAY_NAME ?? null },
}));
```

Keep one config route for every Thai integration: when the app also uses
LINE, add `line: getPublicLineConfig()` to the same object.

## Manual PromptPay QR — `server/routes/api/orders/[id]/promptpay.get.ts`

```ts
import { defineHandler } from "nitro";
import { createError, getRouterParam } from "nitro/h3";
import { getDb } from "../../../../utils/db";
import { generatePromptPayPayload } from "../../../../utils/thai/promptpay";

export default defineHandler(async (event) => {
  const id = getRouterParam(event, "id");
  const { rows } = await getDb().query(
    "select id, status, total_satang from orders where id = $1",
    [id],
  );
  const order = rows[0];
  if (!order) throw createError({ statusCode: 404, statusMessage: "Order not found" });
  if (order.status !== "awaiting_payment") return { status: order.status };
  const promptPayId = process.env.PROMPTPAY_ID;
  if (!promptPayId) throw createError({ statusCode: 503, statusMessage: "PromptPay is not set up yet" });
  return {
    status: order.status,
    amountSatang: order.total_satang,
    payload: generatePromptPayPayload(promptPayId, { amount: order.total_satang / 100 }),
    displayName: process.env.PROMPTPAY_DISPLAY_NAME ?? null,
  };
});
```

Client:

```tsx
import { QRCodeSVG } from "qrcode.react";

<figure className="flex flex-col items-center gap-3 rounded-xl border bg-card p-6">
  <figcaption className="font-medium">สแกนจ่ายด้วยพร้อมเพย์</figcaption>
  <QRCodeSVG value={data.payload} size={232} marginSize={2} />
  <p className="text-sm">ชื่อบัญชี: {data.displayName}</p>
  <p className="text-2xl font-semibold">{baht.format(data.amountSatang / 100)}</p>
  <p className="text-sm text-muted-foreground">
    หลังโอนแล้ว ร้านจะตรวจสอบยอดและยืนยันคำสั่งซื้อให้ (สถานะจะยังเป็น “รอชำระเงิน” จนกว่าจะยืนยัน)
  </p>
</figure>;
```

Staff confirmation is an authenticated admin action that sets
`orders.status = 'paid'` with `where status = 'awaiting_payment'` and records
who confirmed it.

## Omise card — `server/routes/api/payments/omise/card.post.ts`

```ts
import { defineHandler } from "nitro";
import { createError, getRequestURL, readBody } from "nitro/h3";
import { getDb } from "../../../../utils/db";
import { createOmiseCardCharge, OmiseApiError, requireOmiseEnv } from "../../../../utils/thai/omise";

export default defineHandler(async (event) => {
  const body = await readBody<{ orderId?: string; token?: string }>(event);
  if (!body?.orderId || !body.token) {
    throw createError({ statusCode: 400, statusMessage: "orderId and token are required" });
  }
  const db = getDb();
  const { rows } = await db.query(
    "select id, total_satang from orders where id = $1 and status = 'awaiting_payment'",
    [body.orderId],
  );
  const order = rows[0];
  if (!order) throw createError({ statusCode: 409, statusMessage: "Order is not awaiting payment" });

  const refId = crypto.randomUUID();
  const inserted = await db.query(
    "insert into payments (order_id, method, amount_satang, ref_id) values ($1, 'omise_card', $2, $3) returning id",
    [order.id, order.total_satang, refId],
  );
  const paymentId = inserted.rows[0].id;
  const origin = process.env.APP_BASE_URL || getRequestURL(event).origin;
  try {
    const charge = await createOmiseCardCharge({
      secretKey: requireOmiseEnv("OMISE_SECRET_KEY"),
      amountSatang: order.total_satang,
      cardToken: body.token,
      refId,
      returnUri: `${origin}/checkout/return?payment=${paymentId}`,
      metadata: { order_id: order.id, payment_id: paymentId },
    });
    await db.query("update payments set omise_charge_id = $2 where id = $1", [paymentId, charge.id]);
    return {
      paymentId,
      status: charge.status,
      authorizeUri: charge.authorize_uri,
      failureMessage: charge.failure_message,
    };
  } catch (error) {
    await db.query("update payments set status = 'failed' where id = $1 and status = 'pending'", [paymentId]);
    if (error instanceof OmiseApiError && error.status < 500) {
      return { paymentId, status: "failed", failureMessage: error.message };
    }
    throw error;
  }
});
```

Client:

```ts
import { openOmiseCardForm } from "@/lib/thai/omise-client";

const config = await fetch("/api/thai/config").then((r) => r.json());
const token = await openOmiseCardForm({
  publicKey: config.omise.publicKey,
  amountSatang: order.totalSatang,
  frameLabel: "ร้านของฉัน",
  submitLabel: "ชำระเงิน",
});
if (!token) return; // closed
const res = await fetch("/api/payments/omise/card", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ orderId: order.id, token }),
}).then((r) => r.json());
if (res.authorizeUri) window.location.assign(res.authorizeUri);
else navigate(`/checkout/return?payment=${res.paymentId}`);
```

The return page polls the status route below until it is no longer `pending`.

## Omise PromptPay — `server/routes/api/payments/omise/promptpay.post.ts`

```ts
import { defineHandler } from "nitro";
import { createError, readBody } from "nitro/h3";
import { getDb } from "../../../../utils/db";
import { createOmisePromptPayCharge, requireOmiseEnv } from "../../../../utils/thai/omise";

export default defineHandler(async (event) => {
  const body = await readBody<{ orderId?: string }>(event);
  const db = getDb();
  const { rows } = await db.query(
    "select id, total_satang from orders where id = $1 and status = 'awaiting_payment'",
    [body?.orderId],
  );
  const order = rows[0];
  if (!order) throw createError({ statusCode: 409, statusMessage: "Order is not awaiting payment" });

  const refId = crypto.randomUUID();
  const inserted = await db.query(
    "insert into payments (order_id, method, amount_satang, ref_id) values ($1, 'omise_promptpay', $2, $3) returning id",
    [order.id, order.total_satang, refId],
  );
  const paymentId = inserted.rows[0].id;
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  const { charge, qrImageUrl } = await createOmisePromptPayCharge({
    secretKey: requireOmiseEnv("OMISE_SECRET_KEY"),
    amountSatang: order.total_satang,
    refId,
    expiresAt,
    metadata: { order_id: order.id, payment_id: paymentId },
  });
  await db.query("update payments set omise_charge_id = $2 where id = $1", [paymentId, charge.id]);
  return { paymentId, qrImageUrl, expiresAt };
});
```

## Status (polling) — `server/routes/api/payments/[id]/status.get.ts`

```ts
import { defineHandler } from "nitro";
import { createError, getRouterParam } from "nitro/h3";
import { syncOmisePayment } from "../../../../utils/payments";

export default defineHandler(async (event) => {
  const status = await syncOmisePayment(String(getRouterParam(event, "id")));
  if (!status) throw createError({ statusCode: 404, statusMessage: "Payment not found" });
  return { status };
});
```

Rate-limit or cache this route if many clients poll; checking Omise every
3 seconds per open checkout is fine for small shops.

## Webhook — `server/routes/api/omise/webhook.post.ts`

```ts
import { defineHandler } from "nitro";
import { createError, getRequestHeaders, readRawBody } from "nitro/h3";
import { getDb } from "../../../utils/db";
import { syncOmisePayment } from "../../../utils/payments";
import { parseOmiseWebhookEvent, verifyOmiseWebhookSignature } from "../../../utils/thai/omise";

export default defineHandler(async (event) => {
  const rawBody = (await readRawBody(event, "utf8")) ?? "";
  const headers = getRequestHeaders(event);
  const valid = await verifyOmiseWebhookSignature({
    rawBody,
    signatureHeader: headers["omise-signature"],
    timestampHeader: headers["omise-signature-timestamp"],
    webhookSecret: process.env.OMISE_WEBHOOK_SECRET,
  });
  if (!valid) throw createError({ statusCode: 401, statusMessage: "Bad signature" });

  const omiseEvent = parseOmiseWebhookEvent(rawBody);
  if (omiseEvent?.key === "charge.complete" && omiseEvent.data.object === "charge") {
    const { rows } = await getDb().query(
      "select id from payments where omise_charge_id = $1",
      [omiseEvent.data.id],
    );
    // The API re-check inside syncOmisePayment is the source of truth.
    if (rows[0]) await syncOmisePayment(rows[0].id);
  }
  return { received: true };
});
```

<nextjs-only>
## Next.js

Same logic in `app/api/.../route.ts` handlers (`export const runtime = "nodejs"`):
`await req.json()` for JSON bodies, `await req.text()` for the webhook raw
body, `req.headers.get("omise-signature")`, `new URL(req.url).origin` for the
return URI, helpers from `@/lib/thai/server/omise` and
`@/lib/thai/promptpay`, and `syncOmisePayment` in `lib/server/payments.ts`.
</nextjs-only>

<vite-nitro-only>

## Supabase Edge Functions

Same flow with `Deno.serve`, helpers from `../_shared/thai/omise.ts` and
`../_shared/thai/promptpay.ts`, and a service-role client for the payment
tables (RLS: customers may read their own orders; only functions write
payments):

```ts
// supabase/functions/omise-webhook/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  confirmOmiseCharge,
  parseOmiseWebhookEvent,
  requireOmiseEnv,
  verifyOmiseWebhookSignature,
} from "../_shared/thai/omise.ts";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

Deno.serve(async (req) => {
  const rawBody = await req.text();
  const valid = await verifyOmiseWebhookSignature({
    rawBody,
    signatureHeader: req.headers.get("omise-signature"),
    timestampHeader: req.headers.get("omise-signature-timestamp"),
    webhookSecret: Deno.env.get("OMISE_WEBHOOK_SECRET"),
  });
  if (!valid) return new Response("Bad signature", { status: 401 });

  const event = parseOmiseWebhookEvent(rawBody);
  if (event?.key !== "charge.complete") return Response.json({ received: true });
  const { data: payment } = await admin
    .from("payments")
    .select("id, order_id, amount_satang, status")
    .eq("omise_charge_id", event.data.id)
    .maybeSingle();
  if (!payment || payment.status !== "pending") return Response.json({ received: true });

  const result = await confirmOmiseCharge({
    secretKey: requireOmiseEnv("OMISE_SECRET_KEY"),
    chargeId: event.data.id,
    expectedAmountSatang: payment.amount_satang,
    expectedOrderId: payment.order_id,
  });
  if (result.paid) {
    const { data: updated } = await admin
      .from("payments")
      .update({ status: "successful" })
      .eq("id", payment.id)
      .eq("status", "pending")
      .select("id");
    if (updated?.length) {
      await admin
        .from("orders")
        .update({ status: "paid", paid_at: new Date().toISOString() })
        .eq("id", payment.order_id)
        .eq("status", "awaiting_payment");
    }
  }
  return Response.json({ received: true });
});
```

Charge-creating functions (`omise-card`, `omise-promptpay`) must verify the
caller's Supabase JWT (`supabase.auth.getUser(token)`) and check the order
belongs to that user before charging.
</vite-nitro-only>
