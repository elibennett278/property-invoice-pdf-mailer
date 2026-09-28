import { z } from "zod";

const money = z.number().finite().nonnegative();

export const issueInvoiceSchema = z.object({
  invoiceId: z.string().min(1).max(80),
  property: z.object({
    name: z.string().min(1),
    address: z.string().min(1),
  }),
  tenant: z.object({
    name: z.string().min(1),
    email: z.string().email(),
  }),
  billing: z.object({
    currency: z.string().length(3).transform((value) => value.toUpperCase()),
    dueDate: z.string().date(),
    lineItems: z.array(z.object({ description: z.string().min(1), amount: money })).min(1),
  }),
  maintenanceRequests: z.array(z.object({
    reference: z.string().min(1),
    summary: z.string().min(1),
    status: z.enum(["reported", "scheduled", "completed"]),
  })).default([]),
  tenantDocuments: z.array(z.object({
    name: z.string().min(1),
    status: z.enum(["received", "requested"]),
  })).default([]),
  inspectionReminders: z.array(z.object({
    date: z.string().date(),
    note: z.string().min(1),
  })).default([]),
});

export type IssueInvoiceInput = z.infer<typeof issueInvoiceSchema>;

export type InvoicePlan = {
  total: number;
  subject: string;
  pdfHtml: string;
  emailHtml: string;
  filename: string;
};

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
})[character] as string);

const list = (items: string[], empty: string) =>
  `<ul>${items.length ? items.map((item) => `<li>${item}</li>`).join("") : `<li>${empty}</li>`}</ul>`;

export function planPropertyInvoice(input: IssueInvoiceInput): InvoicePlan {
  const total = input.billing.lineItems.reduce((sum, item) => sum + item.amount, 0);
  const amount = new Intl.NumberFormat("en", {
    style: "currency",
    currency: input.billing.currency,
  }).format(total);
  const lineItems = input.billing.lineItems.map((item) =>
    `<tr><td>${escapeHtml(item.description)}</td><td>${item.amount.toFixed(2)}</td></tr>`).join("");
  const maintenance = input.maintenanceRequests.map((request) =>
    `${escapeHtml(request.reference)}: ${escapeHtml(request.summary)} (${request.status})`);
  const documents = input.tenantDocuments.map((document) =>
    `${escapeHtml(document.name)}: ${document.status}`);
  const inspections = input.inspectionReminders.map((reminder) =>
    `${escapeHtml(reminder.date)}: ${escapeHtml(reminder.note)}`);

  return {
    total,
    subject: `Invoice ${input.invoiceId} for ${input.property.name}`,
    filename: `property-invoice-${input.invoiceId}.pdf`,
    emailHtml: `<p>Hello ${escapeHtml(input.tenant.name)},</p><p>Your ${amount} property invoice is attached. Payment is due ${escapeHtml(input.billing.dueDate)}.</p>`,
    pdfHtml: `<!doctype html><html><body><h1>Property invoice ${escapeHtml(input.invoiceId)}</h1><p>${escapeHtml(input.property.name)}<br>${escapeHtml(input.property.address)}</p><table><thead><tr><th>Charge</th><th>Amount</th></tr></thead><tbody>${lineItems}</tbody></table><p><strong>Total: ${amount}</strong></p><p>Due: ${escapeHtml(input.billing.dueDate)}</p><h2>Maintenance requests</h2>${list(maintenance, "No open requests")}<h2>Tenant documents</h2>${list(documents, "No documents listed")}<h2>Inspection reminders</h2>${list(inspections, "No inspections scheduled")}</body></html>`,
  };
}
