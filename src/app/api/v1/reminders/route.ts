import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { can } from "@/lib/permissions";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || !can(session.user.role, "reminders", "view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const reminders = await prisma.reminder.findMany({ orderBy: { offsetDays: "asc" } });
  return NextResponse.json(reminders);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !can(session.user.role, "reminders", "write")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await req.json();
  const reminder = await prisma.reminder.create({ data: body });
  return NextResponse.json(reminder, { status: 201 });
}
