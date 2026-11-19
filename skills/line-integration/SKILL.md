---
slug: line-integration
name: LINE integration
version: 1.0.0
description: LINE Login (OAuth 2.1/OIDC with PKCE), LIFF apps and LINE Messaging API bots with server-side ID-token verification, webhook signature checks, reply/push and signed app sessions.
when_to_use: When the user asks for "login with LINE", a LIFF app inside LINE, a LINE OA chatbot, LINE notifications, or LINE webhooks, or when reviewing LINE code for security problems.
tags: [line, auth, login, liff, chatbot, webhook, thai, messaging]
roles: [backend-developer, frontend-developer]
framework_sections: true
license: MIT
references:
  - file: references/routes.md
    description: Complete LINE Login, LIFF verification, Messaging API webhook and config routes for Vite + Nitro, Supabase Edge Functions (with a Supabase Auth session) or Next.js.
---

# LINE integration

Thailand's default messenger is LINE, so "login with LINE", LIFF mini apps and
LINE Official Account (OA) bots are common requests. There are two different
channel types in the LINE Developers Console:

| Need                                    | Channel        | Keys                                                        |
| --------------------------------------- | -------------- | ----------------------------------------------------------- |
| Sign in with LINE, LIFF apps            | LINE Login     | `LINE_LOGIN_CHANNEL_ID`, `LINE_LOGIN_CHANNEL_SECRET`, `LINE_LIFF_ID` |
| OA chatbot, notifications, webhooks     | Messaging API  | `LINE_MESSAGING_CHANNEL_SECRET`, `LINE_MESSAGING_CHANNEL_ACCESS_TOKEN` |

## Start with the KODRA helpers

In KODRA, call `add_thai_integration` (`line_login`, `liff` or
`line_messaging`) first. It writes a tested `line.ts` helper into the server
code (`server/utils/thai/line.ts`, `lib/thai/server/line.ts` or
`supabase/functions/_shared/thai/line.ts`) with:

- `verifyLineSignature(rawBody, signature, channelSecret)` — webhook check
- `createLineLoginRequest`, `exchangeLineLoginCode`, `verifyLineIdToken`
- `replyLineMessage`, `pushLineMessage` (with `X-Line-Retry-Key`)
- `signLineSession`, `verifyLineSession`, `getLineSessionSecret`,
  `buildCookie`, `readCookie` — a signed httpOnly session cookie
- `getPublicLineConfig()`, `requireLineEnv(name)`

Use these instead of writing HMAC, PKCE or token checks by hand.

## Non-negotiable security rules

1. **Secrets stay on the server.** Channel secrets and the channel access
   token are read only in server code (`process.env` / `Deno.env.get`). Never
   `VITE_*` / `NEXT_PUBLIC_*`, never in `src/` client code, never in chat.
   The owner enters them in KODRA's Configure panel → Thai integrations.
2. **Never trust identity from the browser.** Not a `userId` in a request
   body, not `liff.getProfile()`, not `liff.getDecodedIDToken()`. Send the raw
   ID token (`liff.getIDToken()`) or authorization code to the server and
   verify it there with `verifyLineIdToken`; use only the returned `sub`.
3. **Verify every webhook** with `x-line-signature` over the raw body before
   parsing JSON. Respond `401` when it fails.
4. **LINE Login flow:** random `state` (CSRF), `nonce` (replay) and PKCE,
   stored in a short-lived httpOnly cookie; compare `state` on the callback;
   verify the ID token with the `nonce`.
5. **Sessions:** after verification, issue the app's own httpOnly session
   cookie (`signLineSession`) or a database session. Don't keep LINE access
   tokens in the browser.

## LINE Login (web)

```
GET /api/auth/line/login     -> 302 to access.line.me (state, nonce, PKCE cookie)
GET /api/auth/line/callback  -> check state, exchange code, verify ID token,
                                upsert user by sub, set session cookie, 302 /
GET /api/auth/me             -> { user } from the session cookie, or 401
POST /api/auth/logout        -> clear the session cookie
```

- Scope `openid profile` gives user ID, name and picture. `email` requires
  applying for email permission on the channel first.
- Register the exact callback URL in the channel's LINE Login tab (one per
  line): the preview origin, e.g. `http://localhost:32100/api/auth/line/callback`
  (LINE accepts `http://localhost`), and the production `https://` URL.
  Show the user which URL to register; set `APP_BASE_URL` when the app sits
  behind a proxy that changes the origin.
- LINE's login page refuses to load inside frames. In KODRA's preview, open
  the login link in a new tab (`target="_blank"`) or test in the browser.
- UI: a green LINE button (`#06C755`, white text, the LINE logo as inline SVG)
  labelled "เข้าสู่ระบบด้วย LINE" / "Log in with LINE".
- To also invite users to the OA, pass `botPrompt: "aggressive"`.

## LIFF apps

- Create the LIFF app on the **LINE Login** channel (LIFF tab), set the
  endpoint URL to the deployed page, and copy the LIFF ID (`1234567890-AbCdEfGh`).
- Client: `npm i @line/liff`. Get the LIFF ID from the server config
  endpoint, then `await liff.init({ liffId })`; outside LINE call
  `liff.login()` when `!liff.isLoggedIn()`.
- Send `liff.getIDToken()` to `POST /api/line/liff/verify`; the server verifies
  it with `LINE_LOGIN_CHANNEL_ID` and returns or stores the profile.
- `liff.isInClient()` tells whether the page runs inside LINE; `liff.sendMessages`
  works only there. Use `liff.closeWindow()` after finishing a flow.
- LIFF pages must be served over https in production.

## Messaging API (OA bot)

- Webhook URL: `https://<domain>/api/line/webhook` in the Messaging API tab;
  turn "Use webhook" on and auto-replies off if the bot answers itself.
- Handler order: read raw body → `verifyLineSignature` → `200` quickly →
  process events. Skip duplicates by `webhookEventId` (and note
  `deliveryContext.isRedelivery`).
- Reply with `replyLineMessage` (free, uses the event's `replyToken`, valid
  only briefly — reply before slow work). Use `pushLineMessage` for later
  notifications (counts toward the plan's monthly quota); pass a stable
  `retryKey` per logical message so retries never double-send.
- To message a user later you need their LINE user ID: either from webhook
  `source.userId` (after they add the OA as a friend) or from LINE Login with
  the same provider. Store it with the user's consent (PDPA).
- Message text max 5000 characters; up to 5 messages per call. Use Flex
  messages for receipts/booking cards (keep `altText` meaningful in Thai).

<vite-nitro-only>
## Where the code goes (Vite)

- **Vite + Nitro:** routes in `server/routes/api/...`, helpers imported from
  `server/utils/thai/line` with relative paths. Read webhook bodies with
  `readRawBody(event, "utf8")` from `"nitro/h3"`. Return redirects and
  cookies as a `new Response(null, { status: 302, headers })` whose headers
  list holds `Location` and one `Set-Cookie` entry per cookie. Full code:
  `references/routes.md`.
- **Supabase app:** Edge Functions in `supabase/functions/<name>/index.ts`
  importing `../_shared/thai/line.ts`; keys are synced to the project's
  secrets by KODRA. LINE Login signs the user into Supabase Auth through a
  one-time magic-link token. Full code: `references/routes.md`.
- **Plain Vite without a server:** only LIFF display works. Call
  `enable_nitro` before LINE Login, webhooks or verified LIFF.
</vite-nitro-only>

<nextjs-only>
## Where the code goes (Next.js)

Route handlers in `app/api/auth/line/login/route.ts`,
`app/api/auth/line/callback/route.ts`, `app/api/line/webhook/route.ts` and
`app/api/line/liff/verify/route.ts` with `export const runtime = "nodejs"`
and `export const dynamic = "force-dynamic"`. Read webhook bodies with
`await req.text()`. Import from `@/lib/thai/server/line` only in server code.
Full code: `references/routes.md`.
</nextjs-only>

## Thai copy

- Login button: "เข้าสู่ระบบด้วย LINE"; logout: "ออกจากระบบ".
- Consent line under the button: "เมื่อเข้าสู่ระบบ คุณยอมรับ[นโยบายความเป็นส่วนตัว]"
  linked to the privacy policy (see thai-localization's PDPA checklist).
- Errors: "เข้าสู่ระบบด้วย LINE ไม่สำเร็จ ลองอีกครั้ง" — never show raw errors.

## Before going live

- [ ] Channel secrets and access token entered in Configure → Thai
      integrations (and in the production host's env if not KODRA publish).
- [ ] Production callback URL and LIFF endpoint URL registered (https).
- [ ] LINE Login channel **Published** (development channels allow only
      testers), Messaging API webhook verified with "Verify" in the console.
- [ ] Webhook returns 401 for a bad signature and 200 within a few seconds.
- [ ] No user ID or profile trusted from the browser; search the client
      bundle for `channel` secrets (none).
- [ ] Privacy policy states what LINE data is stored and why (PDPA).
