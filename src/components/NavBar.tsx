"use client";
import Link from "next/link";
import { signOut } from "next-auth/react";

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/customers", label: "Customers" },
  { href: "/invoices", label: "Invoices" },
  { href: "/payments", label: "Payments" },
  { href: "/expenses", label: "Expenses" },
];

export function NavBar({ user }: { user: { name: string; role: string } }) {
  return (
    <header className="border-b border-line bg-white">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <span className="font-display text-lg text-ink">BTG Billing</span>
          <nav className="flex gap-1">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="px-3 py-2 text-sm text-slate hover:text-ink hover:bg-mist rounded-md transition"
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-slate">
            {user.name} <span className="text-xs bg-accentSoft text-accent px-2 py-0.5 rounded-full ml-1">{user.role}</span>
          </span>
          <button onClick={() => signOut({ callbackUrl: "/login" })} className="btn-secondary text-xs">
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
