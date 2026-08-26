import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import type { InvoiceItem, Payment, PaymentAllocation } from "@prisma/client";

type AllocationWithPayment = PaymentAllocation & { payment: Payment };

function inr(n: unknown) {
  return "₹ " + Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default async function InvoiceDetailPage({ params }: { params: { id: string } }) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: params.id },
    include: {
      items: { orderBy: { sortOrder: "asc" } },
      customer: true,
      paymentAllocations: { include: { payment: true }, orderBy: { createdAt: "desc" } },
    },
  });
  if (!invoice) notFound();

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl">{invoice.invoiceNumber}</h1>
          <p className="text-slate text-sm mt-1">{invoice.customer.name} · {invoice.status.replace("_", " ")}</p>
        </div>
        <div className="flex gap-2">
          <a href={`/api/v1/invoices/${invoice.id}/pdf`} target="_blank" className="btn-secondary">View PDF</a>
          <Link href={`/payments/new?customerId=${invoice.customerId}&invoiceId=${invoice.id}`} className="btn-primary">
            Record payment
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="card"><div className="text-xs text-slate uppercase">Total</div><div className="font-display text-xl">{inr(invoice.grandTotal)}</div></div>
        <div className="card"><div className="text-xs text-slate uppercase">Paid</div><div className="font-display text-xl text-accent">{inr(invoice.amountPaid)}</div></div>
        <div className="card"><div className="text-xs text-slate uppercase">Outstanding</div><div className="font-display text-xl text-warn">{inr(invoice.outstandingAmount)}</div></div>
      </div>

      <div className="card p-0 overflow-hidden">
        <table className="w-full table-shell">
          <thead><tr><th>Description</th><th>HSN/SAC</th><th>Qty</th><th>Rate</th><th>GST</th><th>Amount</th></tr></thead>
          <tbody>
            {invoice.items.map((it: InvoiceItem) => (
              <tr key={it.id}>
                <td>{it.description}</td>
                <td>{it.hsnSacCode}</td>
                <td>{Number(it.quantity)}</td>
                <td>{inr(it.unitPrice)}</td>
                <td>{Number(it.gstRate)}%</td>
                <td>{inr(it.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h2 className="font-medium mb-3">Payment history</h2>
        {invoice.paymentAllocations.length === 0 ? (
          <p className="text-sm text-slate">No payments recorded yet.</p>
        ) : (
          <table className="w-full table-shell">
            <thead><tr><th>Date</th><th>Method</th><th>Reference</th><th>Allocated</th></tr></thead>
            <tbody>
              {invoice.paymentAllocations.map((a: AllocationWithPayment) => (
                <tr key={a.id}>
                  <td>{new Date(a.payment.paymentDate).toLocaleDateString("en-IN")}</td>
                  <td>{a.payment.method.replace("_", " ")}</td>
                  <td>{a.payment.referenceNumber || "—"}</td>
                  <td>{inr(a.allocatedAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
