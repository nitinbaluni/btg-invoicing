import { prisma } from "@/lib/db";
import type { Invoice, Customer } from "@prisma/client";

type InvoiceWithCustomer = Invoice & { customer: Customer };

function inr(n: number) {
  return "₹ " + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

async function getStats() {
  const [invoiceAgg, paymentAgg, expenseAgg, overdueInvoices, upcomingInvoices] = await Promise.all([
    prisma.invoice.aggregate({
      _sum: { grandTotal: true, amountPaid: true, outstandingAmount: true },
      where: { status: { not: "VOID" } },
    }),
    prisma.payment.aggregate({ _sum: { amount: true } }),
    prisma.expense.aggregate({ _sum: { amount: true } }),
    prisma.invoice.findMany({
      where: { status: { notIn: ["PAID", "VOID"] }, dueDate: { lt: new Date() } },
      include: { customer: true },
      orderBy: { dueDate: "asc" },
      take: 8,
    }) as Promise<InvoiceWithCustomer[]>,
    prisma.invoice.findMany({
      where: { status: { notIn: ["PAID", "VOID"] }, dueDate: { gte: new Date() } },
      include: { customer: true },
      orderBy: { dueDate: "asc" },
      take: 8,
    }) as Promise<InvoiceWithCustomer[]>,
  ]);

  const totalInflow = Number(paymentAgg._sum.amount || 0);
  const totalOutflow = Number(expenseAgg._sum.amount || 0);

  return {
    totalInvoiced: Number(invoiceAgg._sum.grandTotal || 0),
    paymentsReceived: Number(invoiceAgg._sum.amountPaid || 0),
    outstanding: Number(invoiceAgg._sum.outstandingAmount || 0),
    overdueAmount: overdueInvoices.reduce((s: number, i: InvoiceWithCustomer) => s + Number(i.outstandingAmount), 0),
    totalExpenses: totalOutflow,
    netCashFlow: totalInflow - totalOutflow,
    overdueInvoices,
    upcomingInvoices,
  };
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: "warn" | "danger" | "accent" }) {
  const toneClass =
    tone === "danger" ? "text-danger" : tone === "warn" ? "text-warn" : tone === "accent" ? "text-accent" : "text-ink";
  return (
    <div className="card">
      <div className="text-xs uppercase tracking-wide text-slate mb-1">{label}</div>
      <div className={`font-display text-2xl ${toneClass}`}>{value}</div>
    </div>
  );
}

export default async function DashboardPage() {
  const stats = await getStats();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl">Dashboard</h1>
        <p className="text-slate text-sm mt-1">Cash position and receivables at a glance.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Kpi label="Total Invoiced" value={inr(stats.totalInvoiced)} />
        <Kpi label="Payments Received" value={inr(stats.paymentsReceived)} tone="accent" />
        <Kpi label="Outstanding" value={inr(stats.outstanding)} tone="warn" />
        <Kpi label="Overdue" value={inr(stats.overdueAmount)} tone="danger" />
        <Kpi label="Total Expenses" value={inr(stats.totalExpenses)} />
        <Kpi
          label="Net Cash Flow"
          value={inr(stats.netCashFlow)}
          tone={stats.netCashFlow >= 0 ? "accent" : "danger"}
        />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="font-medium mb-3">Overdue Invoices</h2>
          {stats.overdueInvoices.length === 0 ? (
            <p className="text-sm text-slate">Nothing overdue right now.</p>
          ) : (
            <table className="w-full table-shell">
              <thead><tr><th>Invoice</th><th>Customer</th><th>Due</th><th>Outstanding</th></tr></thead>
              <tbody>
                {stats.overdueInvoices.map((inv) => (
                  <tr key={inv.id}>
                    <td>{inv.invoiceNumber}</td>
                    <td>{inv.customer.name}</td>
                    <td>{new Date(inv.dueDate).toLocaleDateString("en-IN")}</td>
                    <td className="text-danger">{inr(Number(inv.outstandingAmount))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card">
          <h2 className="font-medium mb-3">Upcoming Payments</h2>
          {stats.upcomingInvoices.length === 0 ? (
            <p className="text-sm text-slate">No upcoming dues.</p>
          ) : (
            <table className="w-full table-shell">
              <thead><tr><th>Invoice</th><th>Customer</th><th>Due</th><th>Outstanding</th></tr></thead>
              <tbody>
                {stats.upcomingInvoices.map((inv) => (
                  <tr key={inv.id}>
                    <td>{inv.invoiceNumber}</td>
                    <td>{inv.customer.name}</td>
                    <td>{new Date(inv.dueDate).toLocaleDateString("en-IN")}</td>
                    <td>{inr(Number(inv.outstandingAmount))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
