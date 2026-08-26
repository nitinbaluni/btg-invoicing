import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { can } from "@/lib/permissions";
import { Prisma } from "@prisma/client";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || !can(session.user.role, "reports", "view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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
      take: 20,
    }),
    prisma.invoice.findMany({
      where: { status: { notIn: ["PAID", "VOID"] }, dueDate: { gte: new Date() } },
      include: { customer: true },
      orderBy: { dueDate: "asc" },
      take: 20,
    }),
  ]);

  // Monthly inflow/outflow for the trailing 12 months
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 11);
  twelveMonthsAgo.setDate(1);

  const monthlyInflow = await prisma.$queryRaw<{ month: string; total: Prisma.Decimal }[]>`
    SELECT to_char(date_trunc('month', "paymentDate"), 'YYYY-MM') as month, SUM(amount) as total
    FROM payments WHERE "paymentDate" >= ${twelveMonthsAgo}
    GROUP BY 1 ORDER BY 1`;

  const monthlyOutflow = await prisma.$queryRaw<{ month: string; total: Prisma.Decimal }[]>`
    SELECT to_char(date_trunc('month', "expenseDate"), 'YYYY-MM') as month, SUM(amount) as total
    FROM expenses WHERE "expenseDate" >= ${twelveMonthsAgo}
    GROUP BY 1 ORDER BY 1`;

  const totalInflow = Number(paymentAgg._sum.amount || 0);
  const totalOutflow = Number(expenseAgg._sum.amount || 0);

  return NextResponse.json({
    totalInvoiced: Number(invoiceAgg._sum.grandTotal || 0),
    paymentsReceived: Number(invoiceAgg._sum.amountPaid || 0),
    outstanding: Number(invoiceAgg._sum.outstandingAmount || 0),
    overdueCount: overdueInvoices.length,
    overdueAmount: overdueInvoices.reduce(
      (s: number, i: (typeof overdueInvoices)[number]) => s + Number(i.outstandingAmount),
      0
    ),
    totalExpenses: totalOutflow,
    totalInflow,
    totalOutflow,
    netCashFlow: totalInflow - totalOutflow,
    upcomingPayments: upcomingInvoices,
    overdueInvoices,
    monthlyInflow: monthlyInflow.map((r: { month: string; total: Prisma.Decimal }) => ({
      month: r.month,
      total: Number(r.total),
    })),
    monthlyOutflow: monthlyOutflow.map((r: { month: string; total: Prisma.Decimal }) => ({
      month: r.month,
      total: Number(r.total),
    })),
  });
}
