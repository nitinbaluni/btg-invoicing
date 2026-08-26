import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { can } from "@/lib/permissions";
import { writeAudit } from "@/lib/audit";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !can(session.user.role, "invoices", "view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const invoice = await prisma.invoice.findUnique({
    where: { id: params.id },
    include: {
      items: { orderBy: { sortOrder: "asc" } },
      customer: true,
      paymentAllocations: { include: { payment: true } },
    },
  });
  if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(invoice);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !can(session.user.role, "invoices", "void")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await req.json();
  if (body.action !== "void") {
    return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  }

  const invoice = await prisma.invoice.update({
    where: { id: params.id },
    data: { status: "VOID" },
  });

  await writeAudit({
    userId: session.user.id,
    action: "invoice.voided",
    entityType: "invoice",
    entityId: invoice.id,
  });

  return NextResponse.json(invoice);
}
