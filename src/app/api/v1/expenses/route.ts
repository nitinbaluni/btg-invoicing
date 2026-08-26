import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { can } from "@/lib/permissions";
import { writeAudit } from "@/lib/audit";

const expenseSchema = z.object({
  categoryId: z.string().uuid(),
  amount: z.number().positive(),
  expenseDate: z.string(),
  vendorName: z.string().optional(),
  description: z.string().optional(),
  paymentMethod: z.enum(["BANK_TRANSFER", "UPI", "CHEQUE", "CASH", "CARD", "OTHER"]),
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || !can(session.user.role, "expenses", "view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const expenses = await prisma.expense.findMany({
    include: { category: true },
    orderBy: { expenseDate: "desc" },
    take: 200,
  });
  return NextResponse.json(expenses);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !can(session.user.role, "expenses", "write")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await req.json();
  const parsed = expenseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const expense = await prisma.expense.create({
    data: { ...parsed.data, expenseDate: new Date(parsed.data.expenseDate), createdById: session.user.id },
  });

  await writeAudit({
    userId: session.user.id,
    action: "expense.created",
    entityType: "expense",
    entityId: expense.id,
    changes: parsed.data,
  });

  return NextResponse.json(expense, { status: 201 });
}
