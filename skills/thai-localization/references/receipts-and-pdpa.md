# Receipts, tax invoices and PDPA basics

Practical basics for app builders, not legal or tax advice. Ask the owner to
confirm details with their accountant (สำนักงานบัญชี) or the Revenue
Department (กรมสรรพากร, https://www.rd.go.th).

## Receipts and tax invoices

| Document | Thai | Who issues it |
| -------- | ---- | ------------- |
| Receipt | ใบเสร็จรับเงิน | Any business, proof of payment |
| Abbreviated tax invoice | ใบกำกับภาษีอย่างย่อ | VAT-registered retail sellers (shops, restaurants) |
| Full tax invoice | ใบกำกับภาษี (เต็มรูป) | VAT-registered sellers, when the buyer asks (needed by businesses to claim input VAT) |
| Receipt/tax invoice | ใบเสร็จรับเงิน/ใบกำกับภาษี | Combined document, common for online shops |

- A business must register for VAT when annual revenue exceeds ฿1.8 million.
  The VAT rate has been 7% for years (the statutory rate is higher and the
  reduction is extended periodically) — keep the rate in configuration, not
  hard-coded in many places.
- Prices to consumers are normally VAT-inclusive. Compute VAT from the
  inclusive total in satang: `vat = Math.round(total * 7 / 107)`,
  `beforeVat = total - vat`.
- **Full tax invoice** must show: the words "ใบกำกับภาษี" prominently; the
  seller's name, address and 13-digit tax ID, plus "สำนักงานใหญ่" or "สาขาที่
  00001"; the buyer's name and address (and, for VAT-registered buyers, their
  tax ID and head office/branch); a running serial number (and book number if
  used); a description, quantity and value of goods/services; the VAT amount
  shown separately from the price; the issue date.
- **Abbreviated tax invoice** shows "ใบกำกับภาษีอย่างย่อ", the seller's name/
  tax ID, serial number, items and the VAT-inclusive price with "VAT
  included" (ราคารวมภาษีมูลค่าเพิ่มแล้ว), and the date.
- Numbering: one gap-free sequence per document type (and per branch),
  generated on the server inside a transaction (e.g. `INV-2569-000123`) —
  never on the client, never reused after cancellation (issue a credit note
  instead).
- Let customers request a full tax invoice at checkout with a "ขอใบกำกับภาษี"
  checkbox revealing: ชื่อบุคคล/นิติบุคคล, เลขประจำตัวผู้เสียภาษี (validate the
  13-digit checksum), สำนักงานใหญ่/สาขา, ที่อยู่.
- Dates on documents in พ.ศ.; amounts with two decimals and the amount in Thai
  words is customary on formal receipts ("หนึ่งพันสองร้อยเก้าสิบบาทถ้วน").
- Electronic documents: the Revenue Department's e-Tax Invoice & e-Receipt
  system lets registered businesses issue signed PDFs/XML; a plain PDF
  emailed to the customer is fine for receipts in most small businesses.
- Business customers paying for services may withhold tax (หัก ณ ที่จ่าย,
  commonly 3%) and send a withholding certificate (50 ทวิ); record the net
  amount received and the certificate.

## PDPA consent checklist

Thailand's Personal Data Protection Act B.E. 2562 (PDPA) applies to apps
that collect personal data of people in Thailand.

- [ ] **Privacy notice at collection** (Thai first): what data, purposes,
      legal basis (contract, consent, legal obligation, legitimate interest),
      retention period, who it is shared with (payment provider, LINE,
      delivery companies), cross-border transfers (cloud hosting), data
      subject rights and how to contact the controller (and DPO if appointed).
- [ ] **Consent only where needed**, and then: a separate, unticked checkbox
      per purpose (e.g. "ยินยอมรับข่าวสารและโปรโมชันทาง LINE/อีเมล"), plain
      Thai wording, not bundled with terms of service, not a condition for
      the service unless necessary.
- [ ] **Sensitive data** (health, religion, biometrics such as face/
      fingerprint, criminal records, ethnicity, disability, sexual behaviour)
      needs explicit consent; avoid collecting it.
- [ ] **Minors** (under 20) need a parent's or guardian's consent unless the
      law lets them consent alone; under 10 always needs the guardian. Ask age
      when the app targets young people.
- [ ] **Record consent:** user, purpose, notice version, timestamp, channel;
      keep withdrawals the same way.
- [ ] **Withdrawal as easy as giving:** a settings toggle or "ยกเลิกการรับข่าวสาร"
      link; LINE OA users can also block the account.
- [ ] **Data subject requests:** a way to request access, correction,
      deletion, portability, objection and restriction (a form or email);
      respond within 30 days.
- [ ] **Cookies:** essential cookies only by default; analytics/marketing
      cookies after the visitor opts in, with a banner that has an equally
      easy "ปฏิเสธ" button.
- [ ] **Security and minimisation:** collect only what the feature needs,
      never log national IDs, phone numbers or LINE IDs in plain text, and
      restrict admin access.
- [ ] **Breach response:** notify the PDPC (สำนักงานคณะกรรมการคุ้มครองข้อมูล
      ส่วนบุคคล) within 72 hours of learning of a breach that risks people's
      rights, and the affected people when the risk is high.

Sample consent copy:

> ☐ ข้าพเจ้ายินยอมให้ [ชื่อร้าน] เก็บและใช้ชื่อ เบอร์โทรศัพท์ และ LINE ID
> เพื่อส่งข่าวสารและโปรโมชัน ข้าพเจ้าสามารถถอนความยินยอมได้ทุกเมื่อในหน้า
> ตั้งค่าบัญชี อ่าน[นโยบายความเป็นส่วนตัว]
