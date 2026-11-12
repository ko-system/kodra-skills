---
slug: thai-localization
name: Thai localization
version: 1.0.0
description: Thai-language apps done right with Thai fonts and line-height, word-aware line breaking via Intl.Segmenter, Buddhist-era dates, THB formatting, Thai addresses and phones, and i18n setup.
when_to_use: When an app's audience is in Thailand, when the owner writes in Thai, when adding a Thai/English language switch, or when Thai text clips, wraps mid-word, shows wrong dates or formats baht incorrectly.
tags: [i18n, thai, localization, typography, dates, currency]
roles: [frontend-developer, localization-specialist, ui-designer, copywriter]
license: MIT
references:
  - file: references/i18n-setup.md
    description: i18next setup for Vite and next-intl for Next.js, language switching, Thai formatting helpers, address and phone formats, and a Thai UI glossary.
scripts:
  - name: find_hardcoded_strings
    file: scripts/find_hardcoded_strings.js
    description: Finds hard-coded UI strings (Thai and English), locale-less date and number formatting, Thai text with clipping-prone or unsupported styles, and a missing Thai font or lang.
    writes: false
---

# Thai localization

Thai is written without spaces between words, stacks vowels and tone marks
above and below consonants, and Thailand uses the Buddhist calendar for
everyday dates. Most Thai UI bugs come from Latin-only assumptions.

## Decide the language setup

- **Thai-only app:** write Thai copy directly in components; no i18n library
  needed. Set `<html lang="th">` and a Thai font. Still use `Intl` formatters
  with the `th-TH` locale.
- **Thai + English (or more):** use an i18n library (i18next for Vite,
  next-intl for Next.js; see `references/i18n-setup.md`). Default to Thai if
  that's the main audience, persist the user's choice, and update
  `document.documentElement.lang` on switch.
- Write natural Thai, not word-for-word English. Keep UI labels short; Thai
  strings are often similar in length to English but cannot be abbreviated.

## Typography

- Fonts with proper Thai glyphs: **IBM Plex Sans Thai** (KODRA scaffold
  default), **Noto Sans Thai**, **Anuphan**, **Sarabun** (long reading);
  **Kanit**, **Prompt** or **Mitr** for short display headings only. Load the
  weights you use (400, 500, 600, 700). Put the Thai family first in the
  stack and a Latin family after it if you pair fonts.
- **Line-height:** body >= 1.7 (`leading-relaxed` is 1.625; use
  `leading-[1.75]`), headings >= 1.35. Tight leading clips stacked vowels and
  tone marks (e.g. ปู่, ที่, ญี่ปุ่น).
- **Never** apply `uppercase`, `italic`, negative `tracking-*` or
  `leading-none`/`leading-tight` to Thai text. Thai has no case and no true
  italics; faux italics and tight tracking look broken.
- Give inputs and buttons enough vertical padding; don't fix their height so
  tightly that descenders (ฤ, ฦ, ู, ุ) clip.
- Font size: Thai glyphs look smaller than Latin at the same size; use 16px
  minimum for body, and consider 17-18px for long text.

```css
/* global stylesheet */
html:lang(th) body {
  line-height: 1.75;
}
html:lang(th) h1,
html:lang(th) h2,
html:lang(th) h3 {
  line-height: 1.4;
  letter-spacing: 0;
}
```

## Line breaking

Browsers break Thai lines using a dictionary, which works for most body text.
Problems appear in narrow containers (buttons, cards, headings) and with
`break-all` / `overflow-wrap: anywhere`, which split words mid-syllable.

- Don't use `break-all` on Thai text. Use `text-wrap: balance`
  (`[text-wrap:balance]`) for headings.
- For headings, buttons and short labels that must wrap at word boundaries,
  insert word-break opportunities with `Intl.Segmenter`:

```tsx
// src/components/ThaiText.tsx
import { Fragment, useMemo } from "react";

const segmenter =
  typeof Intl !== "undefined" && "Segmenter" in Intl
    ? new Intl.Segmenter("th", { granularity: "word" })
    : null;

export function ThaiText({ children }: { children: string }) {
  const parts = useMemo(
    () =>
      segmenter
        ? Array.from(segmenter.segment(children), (s) => s.segment)
        : [children],
    [children],
  );
  return (
    <>
      {parts.map((part, i) => (
        <Fragment key={i}>
          {part}
          {i < parts.length - 1 && <wbr />}
        </Fragment>
      ))}
    </>
  );
}
```

Use it as `<h2 className="[text-wrap:balance]"><ThaiText>{title}</ThaiText></h2>`.
Keep units and names together with a non-breaking space (` `): "฿1,290 บาท",
"10 นาที".

## Dates and times

- Store and send UTC ISO timestamps (Gregorian). Convert only for display.
- `th-TH` formatting uses the Buddhist calendar automatically:

```ts
const dateTH = new Intl.DateTimeFormat("th-TH", {
  dateStyle: "long",
  timeZone: "Asia/Bangkok",
});
dateTH.format(new Date("2026-11-12T03:00:00Z")); // "12 พฤศจิกายน 2569"
const shortTH = new Intl.DateTimeFormat("th-TH", {
  day: "numeric",
  month: "short",
  year: "2-digit",
  timeZone: "Asia/Bangkok",
});
shortTH.format(new Date("2026-11-12T03:00:00Z")); // "12 พ.ย. 69"
const timeTH = new Intl.DateTimeFormat("th-TH", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Bangkok",
});
timeTH.format(new Date("2026-11-12T03:00:00Z")); // "10:00 น."
// Gregorian years in Thai text, when the owner prefers them:
new Intl.DateTimeFormat("th-TH-u-ca-gregory", { dateStyle: "long" }); // "12 พฤศจิกายน ค.ศ. 2026"
```

- Pass `timeZone: "Asia/Bangkok"` for business hours, bookings and
  deadlines so users abroad and servers in UTC show the right local time.
- date-fns `format(..., { locale: th })` gives Thai month names but a
  Gregorian year; add 543 yourself or prefer `Intl` for display.
- Date pickers: shadcn `Calendar` with `locale={th}` from `date-fns/locale`
  shows Thai month/day names; label the year system when showing years.
- Never call `toLocaleDateString()` without a locale; it follows the
  visitor's browser and gives inconsistent output.

## Numbers and money

```ts
const baht = new Intl.NumberFormat("th-TH", {
  style: "currency",
  currency: "THB",
});
baht.format(1290); // "฿1,290.00"
const bahtWhole = new Intl.NumberFormat("th-TH", {
  style: "currency",
  currency: "THB",
  maximumFractionDigits: 0,
});
bahtWhole.format(1290); // "฿1,290"
new Intl.NumberFormat("th-TH").format(1234567.5); // "1,234,567.5"
```

- Store money as integer satang; divide by 100 only for display.
- Prices usually include 7% VAT; say "ราคารวม VAT" when relevant.
- Western digits are standard in UI; Thai digits (๑๒๓) only for formal or
  decorative use (`th-TH-u-nu-thai`).
- Sort Thai strings with `Intl.Collator("th")` or `a.localeCompare(b, "th")`.

## Thai-specific data

- Phone: mobile 10 digits starting 06/08/09, display `081-234-5678`; store
  digits only (or E.164 `+66812345678`).
- Address order: house number, village/building, soi, road, sub-district
  (ตำบล or แขวง in Bangkok), district (อำเภอ or เขต), province, postal code.
  Use separate fields for province and postal code; a province `Select` with
  all 77 provinces helps.
- Names: optional title (นาย, นาง, นางสาว), first name, last name; many users
  prefer a nickname for display.
- Payments: PromptPay and mobile banking are expected alongside cards (see the
  ecommerce-checkout skill).

## Checklist

- [ ] `<html lang="th">` (or switches with the language).
- [ ] Thai-capable font loaded; body line-height >= 1.7, headings >= 1.35.
- [ ] No uppercase, italic, negative tracking or tight leading on Thai text.
- [ ] Headings and buttons wrap at word boundaries (no mid-word breaks).
- [ ] Dates via `Intl` with `th-TH` and `Asia/Bangkok`; money via THB formatter.
- [ ] Validation messages, toasts, empty states and emails in Thai.
- [ ] Ran `find_hardcoded_strings`; strings are translated (bilingual apps) or
      consistently Thai (Thai-only apps).

## Script

`find_hardcoded_strings` args (optional): `{ "dir": "src", "maxFindings":
150, "includeUi": false }`. Returns `i18nLibrary` (from package.json),
`counts` of hard-coded strings by script (thai, latin, mixed), `filesUsingI18n`,
and `findings` with rules `hardcoded-text`, `hardcoded-attribute`,
`hardcoded-toast`, `locale-less-format`, `thai-typography`, `missing-thai-font`
and `html-lang`. In a Thai-only app, hard-coded Thai is fine; focus on stray
English strings and the typography/format rules.
