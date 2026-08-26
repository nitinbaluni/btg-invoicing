import { prisma } from "@/lib/db";
import { NewPaymentForm } from "./NewPaymentForm";

export default async function NewPaymentPage({
  searchParams,
}: {
  searchParams: { customerId?: string; invoiceId?: string };
}) {
  const customers = await prisma.customer.findMany({ where: { isActive: true }, orderBy: { name: "asc" } });
  return (
    <NewPaymentForm
      customers={customers}
      preselectedCustomerId={searchParams.customerId}
      preselectedInvoiceId={searchParams.invoiceId}
    />
  );
}
