import express from "express";
import { ZodError } from "zod";
import { InfraiError } from "./infrai.js";
import { issuePropertyInvoice } from "./invoice_dispatch.js";
import { issueInvoiceSchema } from "./property_invoice.js";

const app = express();
app.use(express.json({ limit: "256kb" }));

app.post("/invoices/issue", async (request, response) => {
  try {
    const invoice = issueInvoiceSchema.parse(request.body);
    response.status(201).json(await issuePropertyInvoice(invoice));
  } catch (error) {
    if (error instanceof ZodError) {
      response.status(400).json({ error: "invalid_request", issues: error.issues });
      return;
    }
    if (error instanceof InfraiError) {
      const status = error.status >= 400 && error.status < 500 ? error.status : 502;
      response.status(status).json({ error: error.code, message: error.message });
      return;
    }
    console.error(error);
    response.status(502).json({ error: "invoice_delivery_failed" });
  }
});

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => console.log(`Invoice service listening on http://localhost:${port}`));
