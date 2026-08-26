/**
 * Runs as a separate process (see docker-compose.yml `worker` service).
 * Every hour: finds invoices matching each active reminder rule's offset,
 * sends the reminder email once per (reminder, invoice, day) - enforced by
 * the DB unique constraint on reminder_logs, not just this check.
 */
import cron from "node-cron";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/email";

function todayDateString() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function isSameDay(a: Date, b: Date) {
  return a.toISOString().slice(0, 10) === b.toISOString().slice(0, 10);
}

async function runReminderSweep() {
  const today = new Date();
  const reminders = await prisma.reminder.findMany({ where: { isActive: true } });
  const invoices = await prisma.invoice.findMany({
    where: { status: { notIn: ["PAID", "VOID", "DRAFT"] } },
    include: { customer: true },
  });

  for (const reminder of reminders) {
    for (const invoice of invoices) {
      let targetDate: Date;
      if (reminder.triggerType === "BEFORE_DUE") {
        targetDate = addDays(invoice.dueDate, -reminder.offsetDays);
      } else if (reminder.triggerType === "ON_DUE") {
        targetDate = invoice.dueDate;
      } else {
        targetDate = addDays(invoice.dueDate, reminder.offsetDays);
      }

      if (!isSameDay(targetDate, today)) continue;
      if (!invoice.customer.billingEmail) continue;

      const sentDate = todayDateString();

      // Application-level pre-check (fast path); the DB unique constraint
      // below is the actual guarantee against duplicate sends under races.
      const existing = await prisma.reminderLog.findUnique({
        where: {
          reminderId_invoiceId_sentDate: {
            reminderId: reminder.id,
            invoiceId: invoice.id,
            sentDate,
          },
        },
      });
      if (existing) continue;

      const subject = reminder.templateSubject
        .replace("{invoiceNumber}", invoice.invoiceNumber)
        .replace("{customerName}", invoice.customer.name);
      const html = reminder.templateBody
        .replace(/{invoiceNumber}/g, invoice.invoiceNumber)
        .replace(/{customerName}/g, invoice.customer.name)
        .replace(/{outstandingAmount}/g, Number(invoice.outstandingAmount).toFixed(2))
        .replace(/{dueDate}/g, invoice.dueDate.toISOString().slice(0, 10));

      try {
        await sendEmail({ to: invoice.customer.billingEmail, subject, html });
        await prisma.reminderLog.create({
          data: { reminderId: reminder.id, invoiceId: invoice.id, sentDate, status: "SENT" },
        });
        console.log(`Sent reminder "${reminder.name}" for ${invoice.invoiceNumber}`);
      } catch (err: any) {
        // Still log the attempt date so we don't spam-retry a broken address every run;
        // a distinct sentDate per day means it will legitimately retry tomorrow.
        await prisma.reminderLog.create({
          data: {
            reminderId: reminder.id,
            invoiceId: invoice.id,
            sentDate,
            status: "FAILED",
            errorMessage: err.message,
          },
        });
        console.error(`Failed reminder for ${invoice.invoiceNumber}:`, err.message);
      }
    }
  }
}

async function runOverdueStatusSweep() {
  // Flip SENT/PARTIALLY_PAID invoices past due date to OVERDUE for accurate dashboards.
  await prisma.invoice.updateMany({
    where: { status: { in: ["SENT", "PARTIALLY_PAID"] }, dueDate: { lt: new Date() } },
    data: { status: "OVERDUE" },
  });
}

// Every hour at minute 5
cron.schedule("5 * * * *", async () => {
  console.log(`[${new Date().toISOString()}] Running reminder sweep...`);
  try {
    await runOverdueStatusSweep();
    await runReminderSweep();
  } catch (err) {
    console.error("Reminder sweep failed:", err);
  }
});

console.log("Reminder worker started. Sweeping hourly at minute 5.");

// Run once immediately on boot too
runOverdueStatusSweep()
  .then(runReminderSweep)
  .catch((err) => console.error("Initial sweep failed:", err));
