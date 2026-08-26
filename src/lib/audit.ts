import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";

export async function writeAudit(params: {
  userId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  changes?: Record<string, unknown>;
  ipAddress?: string | null;
  tx?: Prisma.TransactionClient;
}) {
  const client = params.tx ?? prisma;
  await client.auditLog.create({
    data: {
      userId: params.userId,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      changes: params.changes ? (params.changes as Prisma.InputJsonValue) : undefined,
      ipAddress: params.ipAddress ?? undefined,
    },
  });
}
