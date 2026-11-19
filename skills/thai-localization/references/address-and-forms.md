# Thai address forms, IDs and dates

## Address data source (licensing checked)

Use an open dataset instead of hand-typing 7,000+ sub-districts:

| Dataset | License | Contents |
| ------- | ------- | -------- |
| [thailand-geography-data/thailand-geography-json](https://github.com/thailand-geography-data/thailand-geography-json) | MIT | 77 provinces, 928 districts, 7,436 sub-districts with postal codes; Thai + English names; from Thailand Post data |
| [kongvut/thai-province-data](https://github.com/kongvut/thai-province-data) | MIT | Provinces, districts, sub-districts, postal codes in JSON/CSV/SQL |

Both are MIT: copying the JSON into the app is allowed; keep the license
text and a credit line (e.g. in `src/data/thai-geography/LICENSE` and the
README or an "about" page). Download the files once into the repo — don't
fetch them from GitHub at runtime.

- The full data is ~1–2 MB of JSON. Put it in `public/data/` and `fetch` it
  when the address form opens, or split it per province; never import it
  into the main bundle.
- Postal-code data comes from a 2018 Thailand Post list. A few sub-districts
  have several postal codes and new ones appear; always let the user edit
  the postal code and type an address that is not in the list.

## Form design

Field order matches how Thais write an address:

1. ชื่อ-นามสกุล (name), เบอร์โทรศัพท์ (phone)
2. บ้านเลขที่ / อาคาร / หมู่ที่ / ซอย / ถนน — one free-text line ("รายละเอียดที่อยู่")
3. จังหวัด (province) → อำเภอ/เขต (district) → ตำบล/แขวง (sub-district) — cascading
   searchable selects (Bangkok uses เขต/แขวง, other provinces อำเภอ/ตำบล;
   change the labels when the province is กรุงเทพมหานคร)
4. รหัสไปรษณีย์ (postal code, 5 digits) — filled from the sub-district, editable

Shortcut that users love: typing a postal code first narrows the sub-district
list to the matching rows ("10110" → คลองเตย / คลองตันเหนือ / ...).

```ts
// zod schema
const thaiAddress = z.object({
  fullName: z.string().trim().min(2, "กรุณากรอกชื่อ-นามสกุล"),
  phone: z.string().regex(/^0[0-9]{8,9}$/, "เบอร์โทรศัพท์ไม่ถูกต้อง"),
  line1: z.string().trim().min(3, "กรุณากรอกรายละเอียดที่อยู่"),
  provinceCode: z.string().min(1, "กรุณาเลือกจังหวัด"),
  districtCode: z.string().min(1, "กรุณาเลือกอำเภอ/เขต"),
  subdistrictCode: z.string().min(1, "กรุณาเลือกตำบล/แขวง"),
  postalCode: z.string().regex(/^[1-9][0-9]{4}$/, "รหัสไปรษณีย์ต้องมี 5 หลัก"),
});
```

Store the codes and the display names (names can change); print the address
as `line1, แขวง/ตำบล X, เขต/อำเภอ Y, จังหวัด Z 10110` (Bangkok: "กรุงเทพมหานคร",
no "จังหวัด").

## Thai national ID / tax ID (13 digits)

The last digit is a mod-11 check digit. Use it to catch typos (it does not
prove the ID exists). Juristic-person tax IDs use the same 13-digit format.

```ts
export function isValidThaiId(input: string): boolean {
  const digits = input.replace(/\D/g, "");
  if (digits.length !== 13) return false;
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(digits[i]) * (13 - i);
  return (11 - (sum % 11)) % 10 === Number(digits[12]);
}
// isValidThaiId("1-1017-00230-70-8") === true
```

Display as `1-1017-00230-70-8`; store digits only. National ID numbers are
personal data under PDPA: collect them only when needed (tax invoices,
regulated services), mask them in lists (`1-1017-xxxxx-xx-8`) and never log them.

## Buddhist-era (พ.ศ.) dates

- พ.ศ. = ค.ศ. + 543 (2026 → 2569). Store Gregorian ISO dates; convert only
  for display with `Intl.DateTimeFormat("th-TH", …)` (Buddhist calendar by
  default) and label the era when it matters: "12 พ.ย. 2569".
- Native `<input type="date">` and most date pickers use ค.ศ. When users
  type a year (e.g. birth year on forms), accept both and normalize:

```ts
export function toGregorianYear(year: number): number {
  return year > 2400 ? year - 543 : year;
}
```

- Thai official documents (receipts, tax invoices, contracts) use พ.ศ.
  dates. The government fiscal year runs 1 October – 30 September.
- Birthdays in Thai forms: day / month (Thai month names) / year (พ.ศ.)
  selects are friendlier than a calendar for older users.
