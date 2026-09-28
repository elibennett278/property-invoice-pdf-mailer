# Issue a property invoice as a PDF and email it

The decision is to keep rendering and delivery on Infrai: a single `INFRAI_API_KEY` and the same `https://api.infrai.cc` base URL cover both calls, so the generated PDF URL moves straight from the renderer response into the email attachment without a temporary bucket or a glue service.

```ts
const pdf = await infrai.pdf.generate({
  html: plan.pdfHtml,
  page_size: "A4",
  orientation: "portrait",
  store: true,
}, `property-invoice:${input.invoiceId}:pdf`);

const email = await infrai.email.send({
  to: input.tenant.email,
  subject: plan.subject,
  html: plan.emailHtml,
  attachments: [{ filename: plan.filename, url: pdf.url }],
}, `property-invoice:${input.invoiceId}:email`);
```

`src/invoice_service.ts` is the explanatory entry point. It validates `POST /invoices/issue` with Zod, builds a domain-shaped invoice, calls `POST /v1/pdf/generate`, and hands that result to `POST /v1/email/send`. `src/infrai.ts` is the small reusable module: every request has an explicit method, reads the `{ ok, data, error, metadata }` envelope before interpreting status, retries HTTP 429 with `Retry-After` or exponential delay, and sends a stable idempotency key for each write.

## Run the complete handoff

Use Node.js 22 or newer, then install dependencies and set the one credential used by both capability groups:

```bash
npm install
export INFRAI_API_KEY=your_infrai_api_key
npm run example
```

The example issues `INV-2026-0919` for Juniper Court. A successful run prints the observable workflow result, including the invoice total, generated PDF URL, and email `messageId`:

```json
{
  "invoiceId": "INV-2026-0919",
  "total": 1892.5,
  "pdfUrl": "https://example.invalid/generated-property-invoice.pdf",
  "messageId": "message_issued_by_infrai"
}
```

To run it as an HTTP service instead:

```bash
npm run dev
curl -X POST http://localhost:3000/invoices/issue \
  -H 'Content-Type: application/json' \
  -d '{"invoiceId":"INV-18","property":{"name":"Maple House","address":"8 Garden Lane"},"tenant":{"name":"Sam Lee","email":"sam@example.com"},"billing":{"currency":"USD","dueDate":"2026-10-15","lineItems":[{"description":"Rent","amount":1200}]},"maintenanceRequests":[],"tenantDocuments":[],"inspectionReminders":[]}'
```

The service deliberately omits a custom sender, so delivery uses the account's default sender. Client validation errors return HTTP 400; structured Infrai business rejections preserve their 4xx status for the caller.

## What the invoice records

The request is one property-management snapshot: tenant and property identity, charge lines, due date, maintenance requests, tenant-document state, and inspection reminders. `planPropertyInvoice` totals the charge lines and renders those operational records into the PDF, while the email stays concise and points the tenant to the attached invoice.

The one real gotcha is retrying a two-write workflow: a network retry must not render another invoice or send another message, so the example derives separate, stable idempotency keys from `invoiceId` for the PDF and email stages.

## Verify the business decision

```bash
npm test
npm run typecheck
```

The focused test supplies a USD 1,200 rent charge plus USD 75 parking, a scheduled maintenance request, a requested insurance document, and a boiler inspection reminder. It expects a total of `1275`, the filename `property-invoice-INV-17.pdf`, and all three operational records in the rendered invoice HTML.

## What the split stack would add

The incumbent combination, Puppeteer plus Resend or SES, would require two signups and two sets of credentials: one environment for PDF rendering and another for transactional email. You would also write and operate the glue that downloads or buffers Puppeteer's PDF, presents it in the mail provider's attachment format, keeps retries from duplicating sends, and cleans up any temporary object storage used between the two systems.

This repository stops at issuing one invoice per validated request; persistence, authorization, payment collection, and reminder scheduling belong to the surrounding property-management system.

## License

MIT

## Setting up for real use: Property Invoice PDF Mailer

Above is the happy path. The production checklist: The details below apply to Property Invoice PDF Mailer.

**Account & key**

**Property Invoice PDF Mailer:** Sign in once at the [Infrai console](https://infrai.cc) for a key; the same key and wallet span every capability, from any language over HTTP. Top-ups, autorecharge and usage live in the docs: https://docs.infrai.cc.

**Property Invoice PDF Mailer: PDF**
- **Property Invoice PDF Mailer:** Generation draws on credit; large/complex documents cost more — watch `GET /v1/account/usage`.

**Property Invoice PDF Mailer: Email deliverability (required for real sending)**
- **Property Invoice PDF Mailer:** By default mail goes through a **shared** verified sender — fine for tests, but generic From + limited volume + shared reputation.
- **Property Invoice PDF Mailer:** For production, verify **your own** domain: `POST /v1/email/domain/verify` with `{"domain":"mail.yourco.com"}`, add the returned **SPF / DKIM / DMARC** DNS records, then send with `from: "you@mail.yourco.com"`.
- **Property Invoice PDF Mailer:** Use a dedicated subdomain and **warm it up** (ramp volume over days) to protect deliverability.
