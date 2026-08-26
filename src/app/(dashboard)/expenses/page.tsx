import { prisma } from "@/lib/db";
import { NewExpenseForm } from "./new/NewExpenseForm";

export default async function NewExpensePage() {
  const categories = await prisma.expenseCategory.findMany({ where: { isActive: true }, orderBy: { name: "asc" } });
  return <NewExpenseForm categories={categories} />;
}
