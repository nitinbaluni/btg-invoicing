import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { can } from "@/lib/permissions";
import { writeAudit } from "@/lib/audit";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !can(session.user.role, "customers", "view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const customer = await prisma.customer.findUnique({
    where: { id: params.id },
    include: { invoices: true, payments: true },
  });
  if (!customer) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(customer);
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !can(session.user.role, "customers", "write")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await req.json();
  const customer = await prisma.customer.update({ where: { id: params.id }, data: body });

  await writeAudit({
    userId: session.user.id,
    action: "customer.updated",
    entityType: "customer",
    entityId: customer.id,
    changes: body,
  });

  return NextResponse.json(customer);
}
