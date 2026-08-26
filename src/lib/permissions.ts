import { Role } from "@prisma/client";

/**
 * Central permission matrix. Keep this as the single source of truth for
 * "who can do what" rather than scattering role checks across route handlers.
 */
export const PERMISSIONS = {
  customers: { view: ["ADMIN", "FINANCE", "SALES"], write: ["ADMIN", "FINANCE", "SALES"] },
  invoices: { view: ["ADMIN", "FINANCE", "SALES"], write: ["ADMIN", "FINANCE", "SALES"], void: ["ADMIN", "FINANCE"] },
  payments: { view: ["ADMIN", "FINANCE"], write: ["ADMIN", "FINANCE"] },
  expenses: { view: ["ADMIN", "FINANCE"], write: ["ADMIN", "FINANCE"] },
  reports: { view: ["ADMIN", "FINANCE"] },
  reminders: { view: ["ADMIN", "FINANCE"], write: ["ADMIN"] },
  users: { view: ["ADMIN"], write: ["ADMIN"] },
  auditLogs: { view: ["ADMIN"] },
} as const;

type Module = keyof typeof PERMISSIONS;

export function can(role: Role | undefined, module: Module, action: string): boolean {
  if (!role) return false;
  const moduleRules = PERMISSIONS[module] as Record<string, readonly string[]>;
  const allowedRoles = moduleRules[action];
  if (!allowedRoles) return false;
  return allowedRoles.includes(role);
}
