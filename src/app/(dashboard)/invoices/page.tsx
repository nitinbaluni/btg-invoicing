import { prisma } from "@/lib/db";
import { NewInvoiceForm } from "./new/NewInvoiceForm";

export default async function NewInvoicePage() {
  const [customers, homeStateSetting] = await Promise.all([
    prisma.customer.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.setting.findUnique({ where: { key: "company.state_code" } }),
  ]);
  return <NewInvoiceForm customers={customers} homeStateCode={homeStateSetting?.value || "07"} />;
}
