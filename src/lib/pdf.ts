import puppeteer from "puppeteer";
import { Invoice, InvoiceItem, Customer } from "@prisma/client";

type InvoiceWithRelations = Invoice & { items: InvoiceItem[]; customer: Customer };

function fmt(n: unknown) {
  return Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function invoiceHtml(invoice: InvoiceWithRelations, company: Record<string, string>) {
  const rows = invoice.items
    .map(
      (it: InvoiceItem, i: number) => `
    <tr>
      <td>${i + 1}</td>
      <td>${it.description}</td>
      <td>${it.hsnSacCode}</td>
      <td class="num">${fmt(it.quantity)}</td>
      <td class="num">${fmt(it.unitPrice)}</td>
      <td class="num">${fmt(it.gstRate)}%</td>
      <td class="num">${fmt(it.cgstAmount)}</td>
      <td class="num">${fmt(it.sgstAmount)}</td>
      <td class="num">${fmt(it.igstAmount)}</td>
      <td class="num">${fmt(it.lineTotal)}</td>
    </tr>`
    )
    .join("");

  return `<!DOCTYPE html>
  <html><head><meta charset="utf-8" />
  <style>
    * { box-sizing: border-box; }
    body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1C2530; font-size: 12px; margin: 0; padding: 32px; }
    h1 { font-size: 20px; margin: 0 0 4px; }
    .muted { color: #4B5A68; }
    .header { display: flex; justify-content: space-between; border-bottom: 2px solid #0F5B4C; padding-bottom: 16px; margin-bottom: 16px; }
    .badge { display: inline-block; padding: 4px 10px; background: #DDEFE9; color: #0F5B4C; font-weight: 600; border-radius: 4px; font-size: 11px; }
    .grid { display: flex; justify-content: space-between; margin-bottom: 16px; }
    .box { width: 48%; }
    .box h3 { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #4B5A68; margin-bottom: 4px; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th { background: #F4F6F8; text-align: left; padding: 6px 8px; font-size: 10px; text-transform: uppercase; border-bottom: 1px solid #E1E6EA; }
    td { padding: 6px 8px; border-bottom: 1px solid #E1E6EA; }
    .num { text-align: right; }
    .totals { width: 320px; margin-left: auto; margin-top: 12px; }
    .totals div { display: flex; justify-content: space-between; padding: 4px 0; }
    .totals .grand { font-weight: 700; font-size: 14px; border-top: 2px solid #0F5B4C; margin-top: 4px; padding-top: 8px; }
    .footer { margin-top: 32px; font-size: 10px; color: #4B5A68; border-top: 1px solid #E1E6EA; padding-top: 12px; }
  </style></head>
  <body>
    <div class="header">
      <div>
        <h1>${company.name}</h1>
        <div class="muted">${company.address || ""}</div>
        <div class="muted">GSTIN: ${company.gstin || "-"}</div>
      </div>
      <div style="text-align:right">
        <div class="badge">${invoice.status.replace("_", " ")}</div>
        <h1 style="margin-top:8px">Tax Invoice</h1>
        <div class="muted">${invoice.invoiceNumber}</div>
      </div>
    </div>

    <div class="grid">
      <div class="box">
        <h3>Billed To</h3>
        <div><strong>${invoice.customer.name}</strong></div>
        <div class="muted">${invoice.customer.billingAddress || ""}</div>
        <div class="muted">State: ${invoice.customer.state} (${invoice.customer.stateCode})</div>
        <div class="muted">GSTIN: ${invoice.customer.gstin || "-"}</div>
      </div>
      <div class="box" style="text-align:right">
        <h3>Invoice Details</h3>
        <div>Invoice Date: ${new Date(invoice.invoiceDate).toLocaleDateString("en-IN")}</div>
        <div>Due Date: ${new Date(invoice.dueDate).toLocaleDateString("en-IN")}</div>
        <div>Place of Supply: ${invoice.placeOfSupply}</div>
        <div>Tax Type: ${invoice.isInterstate ? "IGST (Inter-state)" : "CGST + SGST (Intra-state)"}</div>
      </div>
    </div>

    <table>
      <thead><tr>
        <th>#</th><th>Description</th><th>HSN/SAC</th><th class="num">Qty</th>
        <th class="num">Rate</th><th class="num">GST%</th><th class="num">CGST</th>
        <th class="num">SGST</th><th class="num">IGST</th><th class="num">Amount</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>

    <div class="totals">
      <div><span>Subtotal</span><span>₹ ${fmt(invoice.subtotal)}</span></div>
      <div><span>CGST</span><span>₹ ${fmt(invoice.cgstTotal)}</span></div>
      <div><span>SGST</span><span>₹ ${fmt(invoice.sgstTotal)}</span></div>
      <div><span>IGST</span><span>₹ ${fmt(invoice.igstTotal)}</span></div>
      <div class="grand"><span>Grand Total</span><span>₹ ${fmt(invoice.grandTotal)}</span></div>
      <div><span>Amount Paid</span><span>₹ ${fmt(invoice.amountPaid)}</span></div>
      <div><strong><span>Outstanding</span><span>₹ ${fmt(invoice.outstandingAmount)}</span></strong></div>
    </div>

    ${invoice.notes ? `<div class="footer"><strong>Notes:</strong> ${invoice.notes}</div>` : ""}
    ${invoice.terms ? `<div class="footer"><strong>Terms:</strong> ${invoice.terms}</div>` : ""}
    <div class="footer">This is a system-generated invoice from ${company.name}.</div>
  </body></html>`;
}

export async function generateInvoicePdf(
  invoice: InvoiceWithRelations,
  company: Record<string, string>
): Promise<Buffer> {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  try {
    const page = await browser.newPage();
    await page.setContent(invoiceHtml(invoice, company), { waitUntil: "networkidle0" });
    const pdf = await page.pdf({ format: "A4", printBackground: true, margin: { top: "20px", bottom: "20px" } });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
