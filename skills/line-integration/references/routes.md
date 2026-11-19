# LINE routes

Complete server code for LINE Login, LIFF verification, the Messaging API
webhook and the public config endpoint. Only the section for this app's
framework is shown.

<vite-nitro-only>
## Vite + Nitro

Helpers come from `server/utils/thai/line.ts` (written by
`add_thai_integration`). Count the `../` from each route file to `server/`.
`defineHandler` comes from `"nitro"`; request helpers from `"nitro/h3"`.

### Public config — `server/routes/api/thai/config.get.ts`

```ts
import { defineHandler } from "nitro";
import { getPublicLineConfig } from "../../../utils/thai/line";

// Public values only. Never add a secret here.
export default defineHandler(() => ({ line: getPublicLineConfig() }));
```

Keep one config route for every Thai integration: when the app also uses
Omise or PromptPay, add `omise: getPublicOmiseConfig()` and the PromptPay
display name to the same object.

### Base URL helper — `server/utils/base-url.ts`

```ts
import { getRequestURL } from "nitro/h3";

/** APP_BASE_URL (behind proxies) or the request origin. */
export function appBaseUrl(event: Parameters<typeof getRequestURL>[0]): string {
  return (process.env.APP_BASE_URL || getRequestURL(event).origin).replace(/\/$/, "");
}
```

### Login — `server/routes/api/auth/line/login.get.ts`

```ts
import { defineHandler } from "nitro";
import {
  buildCookie,
  createLineLoginRequest,
  requireLineEnv,
} from "../../../../utils/thai/line";
import { appBaseUrl } from "../../../../utils/base-url";

export default defineHandler(async (event) => {
  const base = appBaseUrl(event);
  const login = await createLineLoginRequest({
    channelId: requireLineEnv("LINE_LOGIN_CHANNEL_ID"),
    redirectUri: `${base}/api/auth/line/callback`,
    uiLocales: "th",
  });
  const pending = JSON.stringify({
    state: login.state,
    nonce: login.nonce,
    verifier: login.codeVerifier,
  });
  return new Response(null, {
    status: 302,
    headers: [
      ["Location", login.url],
      [
        "Set-Cookie",
        buildCookie("line_login", pending, {
          maxAgeSeconds: 600,
          secure: base.startsWith("https://"),
          path: "/api/auth/line",
        }),
      ],
    ],
  });
});
```

### Callback — `server/routes/api/auth/line/callback.get.ts`

```ts
import { defineHandler } from "nitro";
import { getQuery, getRequestHeaders } from "nitro/h3";
import {
  buildCookie,
  exchangeLineLoginCode,
  getLineSessionSecret,
  readCookie,
  requireLineEnv,
  signLineSession,
  timingSafeEqualString,
  verifyLineIdToken,
} from "../../../../utils/thai/line";
import { appBaseUrl } from "../../../../utils/base-url";

export default defineHandler(async (event) => {
  const base = appBaseUrl(event);
  const secure = base.startsWith("https://");
  const clearPending = buildCookie("line_login", "", {
    maxAgeSeconds: 0,
    secure,
    path: "/api/auth/line",
  });
  const redirect = (location: string, cookies: string[] = []) =>
    new Response(null, {
      status: 302,
      headers: [
        ["Location", location],
        ["Set-Cookie", clearPending],
        ...cookies.map((c): [string, string] => ["Set-Cookie", c]),
      ],
    });

  const query = getQuery(event) as Record<string, string | undefined>;
  const raw = readCookie(getRequestHeaders(event).cookie, "line_login");
  if (query.error || !query.code || !query.state || !raw) {
    return redirect("/login?error=line_cancelled");
  }
  let pending: { state: string; nonce: string; verifier: string };
  try {
    pending = JSON.parse(raw);
  } catch {
    return redirect("/login?error=line_state");
  }
  if (!timingSafeEqualString(query.state, pending.state)) {
    return redirect("/login?error=line_state");
  }

  try {
    const channelId = requireLineEnv("LINE_LOGIN_CHANNEL_ID");
    const tokens = await exchangeLineLoginCode({
      code: query.code,
      redirectUri: `${base}/api/auth/line/callback`,
      channelId,
      channelSecret: requireLineEnv("LINE_LOGIN_CHANNEL_SECRET"),
      codeVerifier: pending.verifier,
    });
    if (!tokens.id_token) return redirect("/login?error=line_scope");
    const claims = await verifyLineIdToken({
      idToken: tokens.id_token,
      channelId,
      nonce: pending.nonce,
    });
    // Upsert the user here when the app has a database, keyed by claims.sub.
    const session = await signLineSession(
      { sub: claims.sub, name: claims.name, picture: claims.picture ?? null },
      getLineSessionSecret(),
    );
    return redirect("/", [
      buildCookie("session", session, {
        maxAgeSeconds: 60 * 60 * 24 * 30,
        secure,
      }),
    ]);
  } catch (error) {
    console.error("LINE login failed", error);
    return redirect("/login?error=line_failed");
  }
});
```

### Current user and logout

```ts
// server/routes/api/auth/me.get.ts
import { defineHandler } from "nitro";
import { createError, getRequestHeaders } from "nitro/h3";
import {
  getLineSessionSecret,
  readCookie,
  verifyLineSession,
} from "../../../utils/thai/line";

export default defineHandler(async (event) => {
  const user = await verifyLineSession(
    readCookie(getRequestHeaders(event).cookie, "session"),
    getLineSessionSecret(),
  );
  if (!user) throw createError({ statusCode: 401, statusMessage: "Not signed in" });
  return { user };
});
```

```ts
// server/routes/api/auth/logout.post.ts
import { defineHandler } from "nitro";
import { getRequestURL } from "nitro/h3";
import { buildCookie } from "../../../utils/thai/line";

export default defineHandler((event) =>
  new Response(null, {
    status: 204,
    headers: {
      "Set-Cookie": buildCookie("session", "", {
        maxAgeSeconds: 0,
        secure: getRequestURL(event).protocol === "https:",
      }),
    },
  }),
);
```

Protect other routes by calling the same `verifyLineSession(...)` at the top
and throwing 401 when it returns null.

### LIFF verification — `server/routes/api/line/liff/verify.post.ts`

```ts
import { defineHandler } from "nitro";
import { createError, readBody } from "nitro/h3";
import { requireLineEnv, verifyLineIdToken } from "../../../../utils/thai/line";

export default defineHandler(async (event) => {
  const body = await readBody<{ idToken?: string }>(event);
  if (!body?.idToken) {
    throw createError({ statusCode: 400, statusMessage: "idToken is required" });
  }
  try {
    const claims = await verifyLineIdToken({
      idToken: body.idToken,
      channelId: requireLineEnv("LINE_LOGIN_CHANNEL_ID"),
    });
    return { userId: claims.sub, name: claims.name ?? null, picture: claims.picture ?? null };
  } catch {
    throw createError({ statusCode: 401, statusMessage: "Invalid LINE token" });
  }
});
```

Client (`src/lib/liff.ts`):

```ts
import liff from "@line/liff";

export async function initLiffAndVerify() {
  const config = await fetch("/api/thai/config").then((r) => r.json());
  if (!config.line.liffId) throw new Error("LIFF is not configured yet");
  await liff.init({ liffId: config.line.liffId });
  if (!liff.isLoggedIn()) {
    liff.login(); // redirects; resolves after returning
    return null;
  }
  const idToken = liff.getIDToken();
  const res = await fetch("/api/line/liff/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });
  if (!res.ok) throw new Error("LINE verification failed");
  return (await res.json()) as { userId: string; name: string | null; picture: string | null };
}
```

### Webhook — `server/routes/api/line/webhook.post.ts`

```ts
import { defineHandler } from "nitro";
import { createError, getRequestHeaders, readRawBody } from "nitro/h3";
import {
  parseLineWebhook,
  replyLineMessage,
  requireLineEnv,
  verifyLineSignature,
} from "../../../utils/thai/line";

export default defineHandler(async (event) => {
  const rawBody = (await readRawBody(event, "utf8")) ?? "";
  const signature = getRequestHeaders(event)["x-line-signature"];
  const valid = await verifyLineSignature(
    rawBody,
    signature,
    process.env.LINE_MESSAGING_CHANNEL_SECRET,
  );
  if (!valid) throw createError({ statusCode: 401, statusMessage: "Bad signature" });

  const { events } = parseLineWebhook(rawBody);
  const token = requireLineEnv("LINE_MESSAGING_CHANNEL_ACCESS_TOKEN");
  for (const e of events) {
    // Skip duplicates: store e.webhookEventId and ignore ones already handled.
    if (e.type === "message" && e.message?.type === "text" && e.replyToken) {
      await replyLineMessage({
        channelAccessToken: token,
        replyToken: e.replyToken,
        messages: [{ type: "text", text: `ได้รับข้อความแล้ว: ${e.message.text}` }],
      });
    }
  }
  return { ok: true };
});
```

LINE's "Verify" button sends an empty `events` array; the handler answers 200.
For slow work (database writes, AI calls), reply first or queue the work.

## Supabase Edge Functions (Vite apps with Supabase)

Helpers come from `supabase/functions/_shared/thai/line.ts` (written by
`add_thai_integration`); import them with `../_shared/thai/line.ts`. KODRA
syncs the LINE keys the owner saves to the project's Edge Function secrets,
so `Deno.env.get(...)` and the helpers' `requireLineEnv` find them. Functions
deploy with `verify_jwt: false`; each function must check what it needs.

Shared CORS headers for browser-called functions:

```ts
// supabase/functions/_shared/cors.ts
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
```

### Public config — `supabase/functions/thai-config/index.ts`

```ts
import { corsHeaders } from "../_shared/cors.ts";
import { getPublicLineConfig } from "../_shared/thai/line.ts";

Deno.serve((req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  return Response.json({ line: getPublicLineConfig() }, { headers: corsHeaders });
});
```

Client: `const { data } = await supabase.functions.invoke("thai-config")`.

### Webhook — `supabase/functions/line-webhook/index.ts`

The webhook URL is `https://<project-ref>.supabase.co/functions/v1/line-webhook`.
LINE sends no Supabase JWT; the signature is the authentication.

```ts
import {
  parseLineWebhook,
  replyLineMessage,
  requireLineEnv,
  verifyLineSignature,
} from "../_shared/thai/line.ts";

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const rawBody = await req.text();
  const valid = await verifyLineSignature(
    rawBody,
    req.headers.get("x-line-signature"),
    Deno.env.get("LINE_MESSAGING_CHANNEL_SECRET"),
  );
  if (!valid) {
    console.warn("[line-webhook] bad signature");
    return new Response("Bad signature", { status: 401 });
  }
  const { events } = parseLineWebhook(rawBody);
  const token = requireLineEnv("LINE_MESSAGING_CHANNEL_ACCESS_TOKEN");
  for (const e of events) {
    if (e.type === "message" && e.message?.type === "text" && e.replyToken) {
      await replyLineMessage({
        channelAccessToken: token,
        replyToken: e.replyToken,
        messages: [{ type: "text", text: `ได้รับข้อความแล้ว: ${e.message.text}` }],
      });
    }
  }
  return Response.json({ ok: true });
});
```

### LINE Login with a Supabase Auth session — `supabase/functions/line-login/index.ts`

Supabase Auth has no built-in LINE provider. This function verifies the LINE
identity and returns a one-time token hash that the browser exchanges for a
normal Supabase session. The Supabase user is keyed by the verified LINE
`sub` through a synthetic, non-deliverable email, so nobody can take over the
account by claiming an email address.

```ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";
import {
  createLineLoginRequest,
  exchangeLineLoginCode,
  requireLineEnv,
  verifyLineIdToken,
} from "../_shared/thai/line.ts";

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

// Only redirect back to pages of this app.
const ALLOWED_ORIGINS = (Deno.env.get("APP_ORIGINS") ?? "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: corsHeaders });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const body = await req.json().catch(() => ({}));
  const channelId = requireLineEnv("LINE_LOGIN_CHANNEL_ID");

  if (body.action === "start") {
    const redirectUri = String(body.redirectUri ?? "");
    const origin = new URL(redirectUri).origin;
    if (ALLOWED_ORIGINS.length > 0 && !ALLOWED_ORIGINS.includes(origin)) {
      return json({ error: "redirect_not_allowed" }, 400);
    }
    const login = await createLineLoginRequest({ channelId, redirectUri, uiLocales: "th" });
    // The browser keeps state, nonce and codeVerifier in sessionStorage.
    return json(login);
  }

  if (body.action === "exchange") {
    try {
      const tokens = await exchangeLineLoginCode({
        code: String(body.code),
        redirectUri: String(body.redirectUri),
        channelId,
        channelSecret: requireLineEnv("LINE_LOGIN_CHANNEL_SECRET"),
        codeVerifier: String(body.codeVerifier),
      });
      if (!tokens.id_token) return json({ error: "no_id_token" }, 400);
      const claims = await verifyLineIdToken({
        idToken: tokens.id_token,
        channelId,
        nonce: String(body.nonce),
      });
      const email = `${claims.sub.toLowerCase()}@line.invalid`;
      const metadata = { line_sub: claims.sub, name: claims.name, avatar_url: claims.picture };
      const created = await admin.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: metadata,
      });
      if (created.error && !/already/i.test(created.error.message)) throw created.error;
      const link = await admin.auth.admin.generateLink({ type: "magiclink", email });
      if (link.error) throw link.error;
      return json({ tokenHash: link.data.properties.hashed_token });
    } catch (error) {
      console.error("[line-login] exchange failed", error);
      return json({ error: "line_login_failed" }, 401);
    }
  }

  return json({ error: "unknown_action" }, 400);
});
```

LINE only redirects to callback URLs registered on the channel, so
`APP_ORIGINS` is an optional second check. To use it, add it as an Edge
Function secret in the Supabase dashboard (Project → Edge Functions →
Secrets), comma-separated, e.g. `http://localhost:32100,https://shop.example`.

Client (`src/lib/lineLogin.ts`):

```ts
import { supabase } from "@/integrations/supabase/client";

const KEY = "line_login_pending";
const redirectUri = () => `${window.location.origin}/auth/line/callback`;

export async function startLineLogin() {
  const { data, error } = await supabase.functions.invoke("line-login", {
    body: { action: "start", redirectUri: redirectUri() },
  });
  if (error) throw error;
  sessionStorage.setItem(
    KEY,
    JSON.stringify({ state: data.state, nonce: data.nonce, verifier: data.codeVerifier }),
  );
  window.location.assign(data.url);
}

// Call from the /auth/line/callback page.
export async function finishLineLogin() {
  const params = new URLSearchParams(window.location.search);
  const pending = JSON.parse(sessionStorage.getItem(KEY) ?? "null");
  sessionStorage.removeItem(KEY);
  if (!pending || params.get("state") !== pending.state || !params.get("code")) {
    throw new Error("LINE login was cancelled or expired");
  }
  const { data, error } = await supabase.functions.invoke("line-login", {
    body: {
      action: "exchange",
      code: params.get("code"),
      codeVerifier: pending.verifier,
      nonce: pending.nonce,
      redirectUri: redirectUri(),
    },
  });
  if (error || !data?.tokenHash) throw error ?? new Error("LINE login failed");
  const { error: otpError } = await supabase.auth.verifyOtp({
    token_hash: data.tokenHash,
    type: "email",
  });
  if (otpError) throw otpError;
}
```

After `finishLineLogin()` the user has a regular Supabase session, so RLS
policies using `auth.uid()` work as usual. Register
`<origin>/auth/line/callback` as the LINE Login callback URL.

### LIFF verification — `supabase/functions/line-liff-verify/index.ts`

```ts
import { corsHeaders } from "../_shared/cors.ts";
import { requireLineEnv, verifyLineIdToken } from "../_shared/thai/line.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const { idToken } = await req.json().catch(() => ({}));
  if (!idToken) return Response.json({ error: "idToken is required" }, { status: 400, headers: corsHeaders });
  try {
    const claims = await verifyLineIdToken({
      idToken,
      channelId: requireLineEnv("LINE_LOGIN_CHANNEL_ID"),
    });
    return Response.json({ userId: claims.sub, name: claims.name ?? null }, { headers: corsHeaders });
  } catch {
    return Response.json({ error: "Invalid LINE token" }, { status: 401, headers: corsHeaders });
  }
});
```

To sign LIFF users into Supabase, reuse the `exchange` branch above with the
LIFF ID token instead of a code (skip `exchangeLineLoginCode`, call
`verifyLineIdToken` without a nonce).
</vite-nitro-only>

<nextjs-only>
## Next.js (App Router)

Helpers come from `lib/thai/server/line.ts` (or `src/lib/thai/server/line.ts`)
written by `add_thai_integration`. Import them only from route handlers,
server actions and server components. Every route below starts with:

```ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
```

### Public config — `app/api/thai/config/route.ts`

```ts
import { getPublicLineConfig } from "@/lib/thai/server/line";

export function GET() {
  return Response.json({ line: getPublicLineConfig() });
}
```

### Login — `app/api/auth/line/login/route.ts`

```ts
import {
  buildCookie,
  createLineLoginRequest,
  requireLineEnv,
} from "@/lib/thai/server/line";

export async function GET(req: Request) {
  const base = (process.env.APP_BASE_URL || new URL(req.url).origin).replace(/\/$/, "");
  const login = await createLineLoginRequest({
    channelId: requireLineEnv("LINE_LOGIN_CHANNEL_ID"),
    redirectUri: `${base}/api/auth/line/callback`,
    uiLocales: "th",
  });
  const pending = JSON.stringify({
    state: login.state,
    nonce: login.nonce,
    verifier: login.codeVerifier,
  });
  return new Response(null, {
    status: 302,
    headers: [
      ["Location", login.url],
      [
        "Set-Cookie",
        buildCookie("line_login", pending, {
          maxAgeSeconds: 600,
          secure: base.startsWith("https://"),
          path: "/api/auth/line",
        }),
      ],
    ],
  });
}
```

### Callback — `app/api/auth/line/callback/route.ts`

```ts
import {
  buildCookie,
  exchangeLineLoginCode,
  getLineSessionSecret,
  readCookie,
  requireLineEnv,
  signLineSession,
  timingSafeEqualString,
  verifyLineIdToken,
} from "@/lib/thai/server/line";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const base = (process.env.APP_BASE_URL || url.origin).replace(/\/$/, "");
  const secure = base.startsWith("https://");
  const clearPending = buildCookie("line_login", "", {
    maxAgeSeconds: 0,
    secure,
    path: "/api/auth/line",
  });
  const redirect = (location: string, cookies: string[] = []) =>
    new Response(null, {
      status: 302,
      headers: [
        ["Location", location],
        ["Set-Cookie", clearPending],
        ...cookies.map((c): [string, string] => ["Set-Cookie", c]),
      ],
    });

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const raw = readCookie(req.headers.get("cookie"), "line_login");
  if (url.searchParams.get("error") || !code || !state || !raw) {
    return redirect("/login?error=line_cancelled");
  }
  let pending: { state: string; nonce: string; verifier: string };
  try {
    pending = JSON.parse(raw);
  } catch {
    return redirect("/login?error=line_state");
  }
  if (!timingSafeEqualString(state, pending.state)) {
    return redirect("/login?error=line_state");
  }

  try {
    const channelId = requireLineEnv("LINE_LOGIN_CHANNEL_ID");
    const tokens = await exchangeLineLoginCode({
      code,
      redirectUri: `${base}/api/auth/line/callback`,
      channelId,
      channelSecret: requireLineEnv("LINE_LOGIN_CHANNEL_SECRET"),
      codeVerifier: pending.verifier,
    });
    if (!tokens.id_token) return redirect("/login?error=line_scope");
    const claims = await verifyLineIdToken({
      idToken: tokens.id_token,
      channelId,
      nonce: pending.nonce,
    });
    // Upsert the user here when the app has a database, keyed by claims.sub.
    const session = await signLineSession(
      { sub: claims.sub, name: claims.name, picture: claims.picture ?? null },
      getLineSessionSecret(),
    );
    return redirect("/", [
      buildCookie("session", session, { maxAgeSeconds: 60 * 60 * 24 * 30, secure }),
    ]);
  } catch (error) {
    console.error("LINE login failed", error);
    return redirect("/login?error=line_failed");
  }
}
```

### Reading the session in server code

```ts
// lib/thai/server/session.ts
import { cookies } from "next/headers";
import { getLineSessionSecret, verifyLineSession } from "./line";

export async function currentUser() {
  const jar = await cookies();
  return verifyLineSession(jar.get("session")?.value, getLineSessionSecret());
}
```

Use it in server components (`const user = await currentUser(); if (!user) redirect("/login")`)
and route handlers. Logout: a route that returns
`buildCookie("session", "", { maxAgeSeconds: 0, secure })` in `Set-Cookie`.

### LIFF verification — `app/api/line/liff/verify/route.ts`

```ts
import { requireLineEnv, verifyLineIdToken } from "@/lib/thai/server/line";

export async function POST(req: Request) {
  const { idToken } = (await req.json().catch(() => ({}))) as { idToken?: string };
  if (!idToken) return Response.json({ error: "idToken is required" }, { status: 400 });
  try {
    const claims = await verifyLineIdToken({
      idToken,
      channelId: requireLineEnv("LINE_LOGIN_CHANNEL_ID"),
    });
    return Response.json({ userId: claims.sub, name: claims.name ?? null });
  } catch {
    return Response.json({ error: "Invalid LINE token" }, { status: 401 });
  }
}
```

LIFF uses browser APIs: initialize it in a `"use client"` component inside
`useEffect` (`const liff = (await import("@line/liff")).default`).

### Webhook — `app/api/line/webhook/route.ts`

```ts
import {
  parseLineWebhook,
  replyLineMessage,
  requireLineEnv,
  verifyLineSignature,
} from "@/lib/thai/server/line";

export async function POST(req: Request) {
  const rawBody = await req.text();
  const valid = await verifyLineSignature(
    rawBody,
    req.headers.get("x-line-signature"),
    process.env.LINE_MESSAGING_CHANNEL_SECRET,
  );
  if (!valid) return new Response("Bad signature", { status: 401 });

  const { events } = parseLineWebhook(rawBody);
  const token = requireLineEnv("LINE_MESSAGING_CHANNEL_ACCESS_TOKEN");
  for (const e of events) {
    if (e.type === "message" && e.message?.type === "text" && e.replyToken) {
      await replyLineMessage({
        channelAccessToken: token,
        replyToken: e.replyToken,
        messages: [{ type: "text", text: `ได้รับข้อความแล้ว: ${e.message.text}` }],
      });
    }
  }
  return Response.json({ ok: true });
}
```
</nextjs-only>
