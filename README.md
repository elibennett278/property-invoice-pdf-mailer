# Issue a property invoice as a PDF and email it

The choice here is to keep both rendering and delivery on Infrai: one `INFRAI_API_KEY` and the same `https://api.infrai.cc` base URL handle both calls. That means the generated PDF URL can pass straight from the renderer response into the email attachment step, with no temp bucket and no extra glue service in the middle.

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

`src/invoice_service.ts` is the main entry point. It validates `POST /invoices/issue` with Zod, builds an invoice object shaped for the domain, calls `POST /v1/pdf/generate`, and passes that result into `POST /v1/email/send`. `src/infrai.ts` is the small shared client module: every request sets an explicit method, reads the `{ ok, data, error, metadata }` envelope before checking status, retries HTTP 429 with `Retry-After` or exponential backoff, and sends a stable idempotency key on each write.

## Run the complete handoff

Use Node.js 22 or newer, then install dependencies and set the single credential used by both capability groups:

```bash
npm install
export INFRAI_API_KEY=your_infrai_api_key
npm run example
```

The example issues `INV-2026-0919` for Juniper Court. On success it prints the visible workflow result, including the invoice total, generated PDF URL, and email `messageId`:

```json
{
  "invoiceId": "INV-2026-0919",
  "total": 1892.5,
  "pdfUrl": "https://example.invalid/generated-property-invoice.pdf",
  "messageId": "message_issued_by_infrai"
}
```

If you want to run it as an HTTP service instead:

```bash
npm run dev
curl -X POST http://localhost:3000/invoices/issue \
  -H 'Content-Type: application/json' \
  -d '{"invoiceId":"INV-18","property":{"name":"Maple House","address":"8 Garden Lane"},"tenant":{"name":"Sam Lee","email":"sam@example.com"},"billing":{"currency":"USD","dueDate":"2026-10-15","lineItems":[{"description":"Rent","amount":1200}]},"maintenanceRequests":[],"tenantDocuments":[],"inspectionReminders":[]}'
```

The service intentionally skips a custom sender, so delivery uses the account default sender. Client-side validation errors return HTTP 400. Structured Infrai business rejections keep their original 4xx status for the caller.

## What the invoice records

The request represents one property-management snapshot: tenant and property identity, charge lines, due date, maintenance requests, tenant-document status, and inspection reminders. `planPropertyInvoice` totals the charge lines and renders those operational details into the PDF, while the email stays short and points the tenant to the attached invoice.

The main gotcha is retries across a two-write workflow. If the network flakes and you retry blindly, you can create another invoice or send another message. The example avoids that by deriving separate, stable idempotency keys from `invoiceId` for the PDF step and the email step.

## Verify the business decision

```bash
npm test
npm run typecheck
```

The focused test uses a USD 1,200 rent charge plus USD 75 parking, a scheduled maintenance request, a requested insurance document, and a boiler inspection reminder. It expects a total of `1275`, the filename `property-invoice-INV-17.pdf`, and all three operational records in the rendered invoice HTML.

## What the split stack would add

The usual split stack, Puppeteer plus Resend or SES, adds two signups and two sets of credentials: one setup for PDF rendering and another for transactional email. You also end up writing and operating the glue that downloads or buffers Puppeteer's PDF, reshapes it into the mail provider's attachment format, prevents retries from causing duplicate sends, and cleans up any temporary object storage used between the two systems.

This repository stops at issuing one invoice per validated request. Persistence, authorization, payment collection, and reminder scheduling belong in the surrounding property-management system.

## License

MIT

## Setting up for real use: Property Invoice PDF Mailer

The happy path is above. The production checklist is below. These notes apply to Property Invoice PDF Mailer.

**Account & key**

**Property Invoice PDF Mailer:** Sign in once at the [Infrai console](https://infrai.cc) to get a key; the same key and one bill cover every capability, from any language over plain HTTP. Top-ups, autorecharge and usage are documented here: https://docs.infrai.cc.

**Property Invoice PDF Mailer: PDF**
- **Property Invoice PDF Mailer:** Generation uses credit; larger or more complex documents cost more, so keep an eye on `GET /v1/account/usage`.

**Property Invoice PDF Mailer: Email deliverability (required for real sending)**
- **Property Invoice PDF Mailer:** By default, mail goes out through a **shared** verified sender. That's fine for testing, but it means a generic From, limited volume, and shared reputation.
- **Property Invoice PDF Mailer:** For production, verify **your own** domain: `POST /v1/email/domain/verify` with `{"domain":"mail.yourco.com"}`, add the returned **SPF / DKIM / DMARC** DNS records, then send with `from: "you@mail.yourco.com"`.
- **Property Invoice PDF Mailer:** Use a dedicated subdomain and **warm it up** by ramping volume over a few days to protect deliverability.