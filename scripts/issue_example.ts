import { issuePropertyInvoice } from "../src/invoice_dispatch.js";
import { issueInvoiceSchema } from "../src/property_invoice.js";

const request = issueInvoiceSchema.parse({
  invoiceId: "INV-2026-0919",
  property: { name: "Juniper Court", address: "14 Market Street, Unit 3B" },
  tenant: { name: "Chen Hua", email: "chenhua@changba.com" },
  billing: {
    currency: "USD",
    dueDate: "2026-10-01",
    lineItems: [
      { description: "Monthly rent", amount: 1850 },
      { description: "Water service", amount: 42.5 }
    ]
  },
  maintenanceRequests: [
    { reference: "MR-184", summary: "Kitchen tap inspection", status: "scheduled" }
  ],
  tenantDocuments: [
    { name: "Renter insurance certificate", status: "received" }
  ],
  inspectionReminders: [
    { date: "2026-10-12", note: "Annual smoke detector inspection" }
  ]
});

const result = await issuePropertyInvoice(request);
console.log(JSON.stringify(result, null, 2));
