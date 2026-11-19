---
slug: thai-payments
name: Thai payments
version: 1.0.0
description: PromptPay QR (EMVCo payload, honest manual confirmation) and Omise (Opn Payments) card and PromptPay charges with server-side pricing, ref_id idempotency, verified webhooks and payment polling.
when_to_use: When a Thai app takes money - "รับเงินผ่าน PromptPay", QR payment, Omise/Opn, card payments in THB, deposits, donations, bookings or orders - or when reviewing payment code for trust and secret-handling bugs.
tags: [payments, promptpay, omise, opn, thai, ecommerce, webhook, qr]
roles: [backend-developer, frontend-developer]
framework_sections: true
license: MIT
references:
  - file: references/server-routes.md
    description: Order, PromptPay QR, Omise card/PromptPay charge, webhook and status routes for Vite + Nitro, Next.js and Supabase Edge Functions.
---

# Thai payments

Two options, with very different guarantees. Pick with the owner:

| Option                 | Fees           | Confirms payment automatically? | Needs                            |
| ---------------------- | -------------- | ------------------------------- | -------------------------------- |
| **PromptPay QR** (own) | Free           | **No** — someone must check     | Owner's PromptPay ID             |
| **Omise** PromptPay    | Per-transaction| Yes (webhook + API check)       | Omise account, server, keys      |
| **Omise** cards        | Per-transaction| Yes (3-D Secure, API check)     | Omise account, server, keys      |

In KODRA call `add_thai_integration` with `promptpay` or `omise` first; it
writes tested helpers (`promptpay.ts`, `omise.ts`, `omise-client.ts`) and the
owner enters keys in Configure → Thai integrations.

## Rules that are never optional

1. **The server decides amounts.** The browser sends product IDs and
   quantities (or an order ID); the server loads prices, computes the total
   in **satang (integer)** and creates the order. Never accept an amount from
   the client.
2. **Secrets stay on the server.** `OMISE_SECRET_KEY` and
   `OMISE_WEBHOOK_SECRET` only in server code. The browser gets the public key
   (`pkey_...`) from a config endpoint. Never `VITE_*`/`NEXT_PUBLIC_*`.
3. **Only the payment provider marks an order paid.** Not a success page, not
   a redirect URL, not an "I've paid" button, not a slip image upload alone.
4. **Idempotency everywhere.** One `payments` row per attempt with a unique
   `ref_id` sent to Omise; webhook and polling updates use
   `... where status = 'pending'` so repeated events change nothing.
5. **Show the mode.** With `skey_test_` keys, show a visible "โหมดทดสอบ / Test
   mode" badge on checkout so nobody thinks real money moved.

## Data model

```sql
create table orders (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'awaiting_payment'
    check (status in ('awaiting_payment','paid','cancelled','refunded','fulfilled')),
  total_satang integer not null check (total_satang > 0),
  created_at timestamptz not null default now(),
  paid_at timestamptz
);
create table payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id),
  method text not null check (method in ('promptpay_manual','omise_card','omise_promptpay')),
  status text not null default 'pending'
    check (status in ('pending','successful','failed','expired')),
  amount_satang integer not null,
  ref_id text not null unique,          -- sent to Omise as ref_id
  omise_charge_id text unique,
  created_at timestamptz not null default now(),
  confirmed_by text                      -- staff member for manual PromptPay
);
```

## PromptPay QR without a provider

- `generatePromptPayPayload(PROMPTPAY_ID, { amount })` returns the QR text.
  Render it with a QR library (`qrcode` → `toDataURL`, or `qrcode.react`
  `<QRCodeSVG value={payload} />`), at least 220 px, with a quiet zone, the
  "Thai QR Payment" heading, the recipient name (`PROMPTPAY_DISPLAY_NAME`) and
  the amount in baht.
- With a server, generate the payload on the server from the order total
  (`GET /api/orders/:id/promptpay`) so the amount can't be edited. In a
  client-only app, generate it in the browser only for fixed amounts or
  donations.
- **Honest UX** (copy it): "สแกนเพื่อชำระ ฿590.00 — หลังโอนแล้ว ร้านจะตรวจสอบยอด
  และยืนยันคำสั่งซื้อให้" / "We confirm your order after we see the transfer."
  The order stays `awaiting_payment`. Offer an optional slip upload and a
  staff "Confirm payment received" action that records who confirmed it.
- Slip images can be faked. If the owner wants automatic slip checks, use a
  bank/slip-verification API on the server — or Omise PromptPay instead.
- Payer's bank app shows the recipient's name; tell customers to check it.

## Omise cards

```
Checkout page -> GET /api/thai/config -> { omise: { publicKey, mode } }
Pay button -> openOmiseCardForm({ publicKey, amountSatang }) -> token (tokn_...)
POST /api/payments/omise/card { orderId, token }
  server: load order -> insert payment(pending, ref_id) -> createOmiseCardCharge
          (amount from DB, return_uri=/checkout/return?order=...)
  <- { status, authorizeUri? }
authorizeUri ? window.location.assign(authorizeUri)  (3-D Secure)
            : show result
/checkout/return -> POST /api/payments/omise/confirm { orderId } -> confirmOmiseCharge
```

- `openOmiseCardForm` uses Omise's own form; card numbers never touch the
  app. Don't build custom card inputs.
- Declines come back as `status: "failed"` with `failure_code`; show a Thai
  message ("บัตรถูกปฏิเสธ ลองบัตรอื่นหรือติดต่อธนาคาร") and let them retry with
  a **new** payment row / `ref_id`.

## Omise PromptPay

```
POST /api/payments/omise/promptpay { orderId }
  server: insert payment(pending) -> createOmisePromptPayCharge -> store charge id
  <- { qrImageUrl, expiresAt }
Page shows the QR image (from Omise) + countdown, polls
GET /api/payments/:id/status every 3 s (server calls confirmOmiseCharge while pending)
Omise -> POST /api/omise/webhook (charge.complete) -> verify signature ->
  confirmOmiseCharge -> mark payment + order paid (idempotent)
```

- Minimum ฿20 (2,000 satang). Default expiry 24 h; set `expiresAt` shorter
  (e.g. 15 min) for checkout and show "QR หมดอายุ" with a "สร้าง QR ใหม่" button.
- Omise does not guarantee webhook retries, so the status endpoint must also
  re-check pending charges with `confirmOmiseCharge`.
- Test mode: in the Omise dashboard open the charge → Actions → mark as
  successful/failed to simulate the payer.

## Webhook

- Register `https://<domain>/api/omise/webhook` (Supabase:
  `.../functions/v1/omise-webhook`) in Omise dashboard → Webhooks, and copy
  the webhook secret into `OMISE_WEBHOOK_SECRET`.
- Read the raw body, `verifyOmiseWebhookSignature` (rejects stale
  timestamps), then for `charge.complete` call `confirmOmiseCharge` with the
  payment's amount and order ID and update rows only `where status = 'pending'`.
  Return 200 for events you ignore.

<vite-nitro-only>
## Where the code goes (Vite)

- **Vite + Nitro:** routes in `server/routes/api/...` importing
  `server/utils/thai/omise` / `promptpay`; raw webhook body via
  `readRawBody(event, "utf8")` from `"nitro/h3"`.
- **Supabase app:** Edge Functions (`omise-card`, `omise-promptpay`,
  `payment-status`, `omise-webhook`, `thai-config`) importing
  `../_shared/thai/omise.ts`; orders in Postgres tables with RLS; the webhook
  function uses the service role key.
- **Client-only Vite:** only the manual PromptPay QR. Call `enable_nitro`
  before Omise.
- Full code: `references/server-routes.md`.
</vite-nitro-only>

<nextjs-only>
## Where the code goes (Next.js)

Route handlers under `app/api/...` with `export const runtime = "nodejs"`,
importing `@/lib/thai/server/omise` and `@/lib/thai/promptpay`. Read the
webhook body with `await req.text()`. Full code: `references/server-routes.md`.
</nextjs-only>

## Thai checkout copy

- Amounts: `฿1,290.00` via `Intl.NumberFormat("th-TH", { style: "currency", currency: "THB" })`.
- Buttons: "ชำระเงิน ฿590", "ชำระด้วยพร้อมเพย์", "ชำระด้วยบัตรเครดิต/เดบิต".
- Pending: "กำลังรอการชำระเงิน…"; paid: "ชำระเงินเรียบร้อย ขอบคุณค่ะ/ครับ";
  failed: "การชำระเงินไม่สำเร็จ ลองอีกครั้ง".
- Receipts and tax invoices: see the thai-localization skill.

## Before going live

- [ ] Test-mode run: successful card, declined card, 3-D Secure, PromptPay
      marked successful and expired in the dashboard; webhook delivered.
- [ ] Live keys entered only in the production environment; mode badge
      disappears in live mode.
- [ ] Webhook endpoint registered for the production URL; bad signature → 401.
- [ ] No `skey_` in the client bundle (KODRA's publish security check also
      blocks it).
- [ ] Refund/cancellation policy and contact details on the checkout page.
- [ ] Manual PromptPay: staff know how to confirm and the UI never says
      "paid" before they do.
