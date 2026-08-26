import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || "ChangeMe!123";
  const passwordHash = await bcrypt.hash(adminPassword, 12);

  const admin = await prisma.user.upsert({
    where: { email: "admin@businesstravelsgroup.in" },
    update: {},
    create: {
      name: "Admin",
      email: "admin@businesstravelsgroup.in",
      passwordHash,
      role: "ADMIN",
    },
  });
  console.log(`Admin user ready: ${admin.email} (password: ${adminPassword} — change this immediately)`);

  await prisma.setting.upsert({
    where: { key: "company.name" },
    update: {},
    create: { key: "company.name", value: "Business Travels Group" },
  });
  await prisma.setting.upsert({
    where: { key: "company.gstin" },
    update: {},
    create: { key: "company.gstin", value: "" }, // fill in via /settings before going live
  });
  await prisma.setting.upsert({
    where: { key: "company.address" },
    update: {},
    create: { key: "company.address", value: "" },
  });
  await prisma.setting.upsert({
    where: { key: "company.state_code" },
    update: {},
    create: { key: "company.state_code", value: "07" }, // Delhi, adjust to your registered state
  });
  await prisma.setting.upsert({
    where: { key: "invoice.number_prefix" },
    update: {},
    create: { key: "invoice.number_prefix", value: "BTG" },
  });

  const categories = ["Vendor Payments", "Travel Operations", "Office & Admin", "Salaries", "Marketing", "Other"];
  for (const name of categories) {
    await prisma.expenseCategory.upsert({ where: { name }, update: {}, create: { name } });
  }

  const reminders = [
    {
      name: "7 days before due",
      triggerType: "BEFORE_DUE" as const,
      offsetDays: 7,
      templateSubject: "Reminder: Invoice {invoiceNumber} due soon",
      templateBody:
        "<p>Dear {customerName},</p><p>This is a reminder that invoice <strong>{invoiceNumber}</strong> for ₹{outstandingAmount} is due on {dueDate}.</p><p>Regards,<br/>Business Travels Group</p>",
    },
    {
      name: "Due today",
      triggerType: "ON_DUE" as const,
      offsetDays: 0,
      templateSubject: "Invoice {invoiceNumber} is due today",
      templateBody:
        "<p>Dear {customerName},</p><p>Invoice <strong>{invoiceNumber}</strong> for ₹{outstandingAmount} is due today ({dueDate}).</p><p>Regards,<br/>Business Travels Group</p>",
    },
    {
      name: "3 days overdue",
      triggerType: "AFTER_DUE" as const,
      offsetDays: 3,
      templateSubject: "Overdue: Invoice {invoiceNumber}",
      templateBody:
        "<p>Dear {customerName},</p><p>Invoice <strong>{invoiceNumber}</strong> for ₹{outstandingAmount} was due on {dueDate} and remains unpaid.</p><p>Regards,<br/>Business Travels Group</p>",
    },
    {
      name: "7 days overdue",
      triggerType: "AFTER_DUE" as const,
      offsetDays: 7,
      templateSubject: "Second notice: Invoice {invoiceNumber} overdue",
      templateBody:
        "<p>Dear {customerName},</p><p>Invoice <strong>{invoiceNumber}</strong> for ₹{outstandingAmount} is now 7 days overdue (due {dueDate}). Please arrange payment at the earliest.</p><p>Regards,<br/>Business Travels Group</p>",
    },
    {
      name: "15 days overdue",
      triggerType: "AFTER_DUE" as const,
      offsetDays: 15,
      templateSubject: "Final notice: Invoice {invoiceNumber} overdue",
      templateBody:
        "<p>Dear {customerName},</p><p>Invoice <strong>{invoiceNumber}</strong> for ₹{outstandingAmount} is now 15 days overdue (due {dueDate}). Please contact us to resolve this at the earliest.</p><p>Regards,<br/>Business Travels Group</p>",
    },
  ];
  for (const r of reminders) {
    const existing = await prisma.reminder.findFirst({ where: { name: r.name } });
    if (!existing) await prisma.reminder.create({ data: r });
  }

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
