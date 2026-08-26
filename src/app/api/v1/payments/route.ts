import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { can } from "@/lib/permissions";
import { writeAudit } from "@/lib/audit";

const allocationSchema = z.object({
  invoiceId: z.string().uuid(),
  amount: z.number().positive(),
});

const paymentSchema = z.object({
  customerId: z.string().uuid(),
  amount: z.number().positive(),
  paymentDate: z.string(),
  method: z.enum(["BANK_TRANSFER", "UPI", "CHEQUE", "CASH", "CARD", "OTHER"]),
  referenceNumber: z.string().optional(),
  notes: z.string().optional(),
  allocations: z.array(allocationSchema).min(1),
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || !can(session.user.role, "payments", "view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const payments = await prisma.payment.findMany({
    include: { customer: true, allocations: { include: { invoice: true } } },
    orderBy: { paymentDate: "desc" },
    take: 200,
  });
  return NextResponse.json(payments);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !can(session.user.role, "payments", "write")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = paymentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;

  const allocatedSum = data.allocations.reduce((s, a) => s + a.amount, 0);
  if (Math.round(allocatedSum * 100) !== Math.round(data.amount * 100)) {
    return NextResponse.json(
      { error: "Sum of allocations must equal the payment amount." },
      { status: 400 }
    );
  }

  try {
    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const payment = await tx.payment.create({
        data: {
          customerId: data.customerId,
          amount: data.amount,
          paymentDate: new Date(data.paymentDate),
          method: data.method,
          referenceNumber: data.referenceNumber,
          notes: data.notes,
          createdById: session.user.id,
        },
      });

      for (const alloc of data.allocations) {
        const invoice = await tx.invoice.findUniqueOrThrow({ where: { id: alloc.invoiceId } });
        const newAmountPaid = new Prisma.Decimal(invoice.amountPaid).add(alloc.amount);

        if (newAmountPaid.greaterThan(invoice.grandTotal)) {
          throw new Error(
            `Allocation of ₹${alloc.amount} to invoice ${invoice.invoiceNumber} exceeds its outstanding balance.`
          );
        }

        const newOutstanding = new Prisma.Decimal(invoice.grandTotal).sub(newAmountPaid);
        const newStatus = newOutstanding.equals(0)
          ? "PAID"
          : newAmountPaid.greaterThan(0)
          ? "PARTIALLY_PAID"
          : invoice.status;

        await tx.paymentAllocation.create({
          data: { paymentId: payment.id, invoiceId: invoice.id, allocatedAmount: alloc.amount },
        });

        await tx.invoice.update({
          where: { id: invoice.id },
          data: { amountPaid: newAmountPaid, outstandingAmount: newOutstanding, status: newStatus },
        });
      }

      await writeAudit({
        userId: session.user.id,
        action: "payment.recorded",
        entityType: "payment",
        entityId: payment.id,
        changes: { amount: data.amount, allocations: data.allocations },
        tx,
      });

      return payment;
    });

    return NextResponse.json(result, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Payment failed" }, { status: 400 });
  }
}
