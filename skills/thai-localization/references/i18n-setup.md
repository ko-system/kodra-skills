# i18n setup for Thai + English apps

## Vite + React: i18next

Install `i18next` and `react-i18next` (add them to dependencies).

```
src/i18n/index.ts
src/i18n/locales/th.json
src/i18n/locales/en.json
```

```ts
// src/i18n/index.ts
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import th from "./locales/th.json";
import en from "./locales/en.json";

export const LANGUAGES = ["th", "en"] as const;
export type Language = (typeof LANGUAGES)[number];
const STORAGE_KEY = "lang";

function initialLanguage(): Language {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === "th" || saved === "en") return saved;
  return navigator.language.toLowerCase().startsWith("en") ? "en" : "th";
}

void i18n.use(initReactI18next).init({
  resources: { th: { translation: th }, en: { translation: en } },
  lng: initialLanguage(),
  fallbackLng: "th",
  interpolation: { escapeValue: false }, // React already escapes
});

document.documentElement.lang = i18n.language;
i18n.on("languageChanged", (lng) => {
  document.documentElement.lang = lng;
  localStorage.setItem(STORAGE_KEY, lng);
});

export default i18n;
```

Import it once in `src/main.tsx` before rendering: `import "./i18n";`.

```json
// src/i18n/locales/th.json
{
  "nav": { "home": "หน้าแรก", "pricing": "ราคา", "contact": "ติดต่อเรา" },
  "hero": {
    "title": "จองคิวร้านของคุณออนไลน์ได้ใน 5 นาที",
    "cta": "เริ่มใช้ฟรี"
  },
  "cart": {
    "items_one": "{{count}} รายการ",
    "items_other": "{{count}} รายการ",
    "empty": "ยังไม่มีสินค้าในตะกร้า"
  },
  "errors": {
    "required": "กรุณากรอก{{field}}",
    "email": "กรุณากรอกอีเมลให้ถูกต้อง"
  }
}
```

```tsx
import { useTranslation } from "react-i18next";

export function HomeHero() {
  const { t } = useTranslation();
  return (
    <Hero title={t("hero.title")} actions={<Button>{t("hero.cta")}</Button>} />
  );
}

export function LanguageSwitch() {
  const { i18n } = useTranslation();
  return (
    <ToggleGroup
      type="single"
      value={i18n.language}
      onValueChange={(v) => v && i18n.changeLanguage(v)}
      aria-label="Language"
    >
      <ToggleGroupItem value="th" aria-label="ภาษาไทย">
        TH
      </ToggleGroupItem>
      <ToggleGroupItem value="en" aria-label="English">
        EN
      </ToggleGroupItem>
    </ToggleGroup>
  );
}
```

Rules:

- Keys are semantic (`cart.empty`), not English sentences.
- Never concatenate translated fragments; use interpolation
  (`t("errors.required", { field: t("fields.phone") })`). Thai word order differs.
- Plurals: Thai has one plural form; still provide `_one`/`_other` for English.
- Translate zod messages by building schemas inside a hook or passing `t`
  (`makeContactSchema(t)`), so messages follow the active language.
- Format with the active locale: `const locale = i18n.language === "th" ? "th-TH" : "en-GB";`

## Next.js App Router: next-intl

Install `next-intl`. Use locale-prefixed routes (`app/[locale]/...`) with
`th` as the default locale, messages in `messages/th.json` and
`messages/en.json`, `useTranslations("hero")` in Client Components and
`getTranslations` in Server Components. Set `<html lang={locale}>` in
`app/[locale]/layout.tsx`, and generate `alternates.languages` in metadata so
search engines see both versions. Follow next-intl's routing setup
(`i18n/routing.ts`, middleware) for the installed version.

## Formatting helpers

```ts
// src/lib/format.ts
export const TZ = "Asia/Bangkok";

export function formatDate(
  iso: string | Date,
  locale = "th-TH",
  style: "short" | "medium" | "long" = "medium",
) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: style,
    timeZone: TZ,
  }).format(new Date(iso));
}

export function formatDateTime(iso: string | Date, locale = "th-TH") {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: TZ,
  }).format(new Date(iso));
}

export function formatBaht(satang: number, { decimals = false } = {}) {
  return new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    minimumFractionDigits: decimals ? 2 : 0,
    maximumFractionDigits: decimals ? 2 : 0,
  }).format(satang / 100);
}

export function formatThaiPhone(digits: string) {
  const d = digits.replace(/\D/g, "");
  if (d.length === 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  if (d.length === 9) return `${d.slice(0, 2)}-${d.slice(2, 5)}-${d.slice(5)}`;
  return digits;
}

export function relativeTime(iso: string | Date, locale = "th-TH") {
  const diffSec = Math.round((new Date(iso).getTime() - Date.now()) / 1000);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  const abs = Math.abs(diffSec);
  if (abs < 60) return rtf.format(diffSec, "second");
  if (abs < 3600) return rtf.format(Math.round(diffSec / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), "hour");
  return rtf.format(Math.round(diffSec / 86400), "day");
}
```

`th-TH` date output uses Buddhist-era years (2569 = 2026). Use
`"th-TH-u-ca-gregory"` only if the owner wants Gregorian years in Thai text.

## Thai address form fields

| Field (Thai label)         | Notes                                |
| -------------------------- | ------------------------------------ |
| บ้านเลขที่ / อาคาร         | Free text                            |
| ซอย / ถนน                  | Optional                             |
| แขวง/ตำบล (sub-district)   | Text, or select filtered by district |
| เขต/อำเภอ (district)       | Text, or select filtered by province |
| จังหวัด (province)         | Select with 77 provinces             |
| รหัสไปรษณีย์ (postal code) | 5 digits, `inputMode="numeric"`      |

## Thai UI glossary

| English         | Thai          | English       | Thai                 |
| --------------- | ------------- | ------------- | -------------------- |
| Sign in         | เข้าสู่ระบบ   | Sign up       | สมัครสมาชิก          |
| Sign out        | ออกจากระบบ    | Save changes  | บันทึกการเปลี่ยนแปลง |
| Cancel          | ยกเลิก        | Delete        | ลบ                   |
| Edit            | แก้ไข         | Search        | ค้นหา                |
| Add to cart     | เพิ่มลงตะกร้า | Checkout      | ชำระเงิน             |
| Book now        | จองเลย        | Contact us    | ติดต่อเรา            |
| Required        | จำเป็น        | Optional      | ไม่บังคับ            |
| Loading...      | กำลังโหลด...  | Try again     | ลองอีกครั้ง          |
| No results      | ไม่พบผลลัพธ์  | Settings      | การตั้งค่า           |
| Price incl. VAT | ราคารวม VAT   | Free shipping | จัดส่งฟรี            |

Use polite, direct phrasing in UI (กรุณา... for requests, no excessive
ค่ะ/ครับ in labels). Match the brand's tone in marketing copy.
