import assert from "node:assert/strict";
import test from "node:test";
import { issueInvoiceSchema, planPropertyInvoice } from "../src/property_invoice.js";

test("the invoice plan totals charges and carries operational records into the PDF", () => {
  const input = issueInvoiceSchema.parse({
    invoiceId: "INV-17",
    property: { name: "Maple House", address: "8 Garden Lane" },
    tenant: { name: "Sam Lee", email: "sam@example.com" },
    billing: {
      currency: "usd",
      dueDate: "2026-10-15",
      lineItems: [
        { description: "Rent", amount: 1200 },
        { description: "Parking", amount: 75 }
      ]
    },
    maintenanceRequests: [
      { reference: "MR-9", summary: "Window latch", status: "scheduled" }
    ],
    tenantDocuments: [{ name: "Insurance", status: "requested" }],
    inspectionReminders: [{ date: "2026-11-03", note: "Boiler check" }]
  });

  const plan = planPropertyInvoice(input);

  assert.equal(plan.total, 1275);
  assert.equal(plan.filename, "property-invoice-INV-17.pdf");
  assert.match(plan.emailHtml, /\$1,275\.00/);
  assert.match(plan.pdfHtml, /MR-9: Window latch \(scheduled\)/);
  assert.match(plan.pdfHtml, /Insurance: requested/);
  assert.match(plan.pdfHtml, /2026-11-03: Boiler check/);
});
