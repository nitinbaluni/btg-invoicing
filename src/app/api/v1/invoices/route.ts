import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { can } from "@/lib/permissions";
import { writeAudit } from "@/lib/audit";
import { computeInvoiceTotals, buildInvoiceNumber, currentFinancialYearLabel } from "@/lib/gst";

const itemSchema = z.object({
  description: z.string().min(1),
  hsnSacCode: z.string().min(1),
  quantity: z.number().positive(),
  unitPrice: z.number().nonnegative(),
  gstRate: z.number().nonnegative(),
});

const invoiceSchema = z.object({
  customerId: z.string().uuid(),
  invoiceDate: z.string(),
  dueDate: z.string(),
  placeOfSupply: z.string().min(1),
  isInterstate: z.boolean(),
  notes: z.string().optional(),
  terms: z.string().optional(),
  items: z.array(itemSchema).min(1),
});

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !can(session.user.role, "invoices", "view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const status = req.nextUrl.searchParams.get("status");
  const invoices = await prisma.invoice.findMany({
    where: status ? { status: status as any } : undefined,
    include: { customer: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return NextResponse.json(invoices);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !can(session.user.role, "invoices", "write")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = invoiceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;

  const totals = computeInvoiceTotals(data.items, data.isInterstate);

  const prefixSetting = await prisma.setting.findUnique({ where: { key: "invoice.number_prefix" } });
  const prefix = prefixSetting?.value || "BTG";
  const fyLabel = currentFinancialYearLabel(new Date(data.invoiceDate));

  const invoice = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    // Sequence per financial year: count existing invoices for this FY prefix + 1.
    // Serialized by the transaction; for high concurrency, switch to a DB sequence.
    const countForFy = await tx.invoice.count({
      where: { invoiceNumber: { startsWith: `${prefix}/${fyLabel}/` } },
    });
    const invoiceNumber = buildInvoiceNumber(prefix, fyLabel, countForFy + 1);

    const created = await tx.invoice.create({
      data: {
        invoiceNumber,
        customerId: data.customerId,
        invoiceDate: new Date(data.invoiceDate),
        dueDate: new Date(data.dueDate),
        placeOfSupply: data.placeOfSupply,
        isInterstate: data.isInterstate,
        subtotal: totals.subtotal,
        cgstTotal: totals.cgstTotal,
        sgstTotal: totals.sgstTotal,
        igstTotal: totals.igstTotal,
        grandTotal: totals.grandTotal,
        amountPaid: 0,
        outstandingAmount: totals.grandTotal,
        status: "SENT",
        notes: data.notes,
        terms: data.terms,
        createdById: session.user.id,
        items: {
          create: totals.items.map((it) => ({
            description: it.description,
            hsnSacCode: it.hsnSacCode,
            quantity: it.quantity,
            unitPrice: it.unitPrice,
            gstRate: it.gstRate,
            cgstAmount: it.cgstAmount,
            sgstAmount: it.sgstAmount,
            igstAmount: it.igstAmount,
            lineTotal: it.lineTotal,
            sortOrder: it.sortOrder,
          })),
        },
      },
      include: { items: true, customer: true },
    });

    await writeAudit({
      userId: session.user.id,
      action: "invoice.created",
      entityType: "invoice",
      entityId: created.id,
      changes: { invoiceNumber, grandTotal: totals.grandTotal.toString() },
      tx,
    });

    return created;
  });

  return NextResponse.json(invoice, { status: 201 });
}
