import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { can } from "@/lib/permissions";
import { writeAudit } from "@/lib/audit";

const customerSchema = z.object({
  name: z.string().min(1),
  billingEmail: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  gstin: z.string().optional(),
  billingAddress: z.string().optional(),
  state: z.string().min(1),
  stateCode: z.string().min(1),
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || !can(session.user.role, "customers", "view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const customers = await prisma.customer.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(customers);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !can(session.user.role, "customers", "write")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = customerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const customer = await prisma.customer.create({ data: parsed.data });

  await writeAudit({
    userId: session.user.id,
    action: "customer.created",
    entityType: "customer",
    entityId: customer.id,
    changes: parsed.data,
  });

  return NextResponse.json(customer, { status: 201 });
}
