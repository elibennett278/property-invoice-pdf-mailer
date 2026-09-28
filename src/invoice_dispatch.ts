import { infrai } from "./infrai.js";
import { planPropertyInvoice, type IssueInvoiceInput } from "./property_invoice.js";

export type InvoiceDispatchResult = {
  invoiceId: string;
  total: number;
  pdfUrl: string;
  messageId: string;
};

export async function issuePropertyInvoice(input: IssueInvoiceInput): Promise<InvoiceDispatchResult> {
  const plan = planPropertyInvoice(input);
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

  return {
    invoiceId: input.invoiceId,
    total: plan.total,
    pdfUrl: pdf.url,
    messageId: email.message_id,
  };
}
