import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { can } from "@/lib/permissions";
import { generateInvoicePdf } from "@/lib/pdf";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !can(session.user.role, "invoices", "view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const invoice = await prisma.invoice.findUnique({
    where: { id: params.id },
    include: { items: { orderBy: { sortOrder: "asc" } }, customer: true },
  });
  if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const settings: { key: string; value: string }[] = await prisma.setting.findMany({
    where: { key: { in: ["company.name", "company.address", "company.gstin"] } },
  });
  const company: Record<string, string> = {
    name: settings.find((s) => s.key === "company.name")?.value || "Business Travels Group",
    address: settings.find((s) => s.key === "company.address")?.value || "",
    gstin: settings.find((s) => s.key === "company.gstin")?.value || "",
  };

  const pdf = await generateInvoicePdf(invoice, company);

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${invoice.invoiceNumber.replace(/\//g, "-")}.pdf"`,
    },
  });
}
