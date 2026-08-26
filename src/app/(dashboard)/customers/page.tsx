"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { prisma } from "@/lib/db";
import type { Customer } from "@prisma/client";

export default async function NewCustomerPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "", billingEmail: "", phone: "", gstin: "", billingAddress: "", state: "", stateCode: "",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const customers: Customer[] = await prisma.customer.findMany({ orderBy: { name: "asc" } });
  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const res = await fetch("/api/v1/customers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (res.ok) {
      router.push("/customers");
      router.refresh();
    } else {
      const data = await res.json();
      setError(JSON.stringify(data.error));
    }
  }

  return (
    <div className="max-w-xl">
      <h1 className="font-display text-2xl mb-6">Add customer</h1>
      <form onSubmit={handleSubmit} className="card space-y-4">
        <div>
          <label className="label">Name</label>
          <input className="input" value={form.name} onChange={(e) => set("name", e.target.value)} required />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Billing email</label>
            <input className="input" type="email" value={form.billingEmail} onChange={(e) => set("billingEmail", e.target.value)} />
          </div>
          <div>
            <label className="label">Phone</label>
            <input className="input" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
          </div>
        </div>
        <div>
          <label className="label">GSTIN</label>
          <input className="input" value={form.gstin} onChange={(e) => set("gstin", e.target.value)} placeholder="Leave blank if unregistered" />
        </div>
        <div>
          <label className="label">Billing address</label>
          <textarea className="input" value={form.billingAddress} onChange={(e) => set("billingAddress", e.target.value)} rows={2} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">State</label>
            <input className="input" value={form.state} onChange={(e) => set("state", e.target.value)} required placeholder="e.g. Delhi" />
          </div>
          <div>
            <label className="label">State code</label>
            <input className="input" value={form.stateCode} onChange={(e) => set("stateCode", e.target.value)} required placeholder="e.g. 07" />
          </div>
        </div>
        {error && <div className="text-sm text-danger bg-dangerSoft rounded-md px-3 py-2">{error}</div>}
        <button type="submit" disabled={saving} className="btn-primary">{saving ? "Saving…" : "Save customer"}</button>
      </form>
    </div>
  );
}
