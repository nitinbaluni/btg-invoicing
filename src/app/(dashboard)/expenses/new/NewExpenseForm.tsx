"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ExpenseCategory } from "@prisma/client"; // resolves once `prisma generate` has run

export function NewExpenseForm({ categories }: { categories: ExpenseCategory[] }) {
  const router = useRouter();
  const [categoryId, setCategoryId] = useState(categories[0]?.id || "");
  const [amount, setAmount] = useState("");
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().slice(0, 10));
  const [vendorName, setVendorName] = useState("");
  const [description, setDescription] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("BANK_TRANSFER");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const res = await fetch("/api/v1/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categoryId, amount: Number(amount), expenseDate, vendorName, description, paymentMethod }),
    });
    setSaving(false);
    if (res.ok) {
      router.push("/expenses");
      router.refresh();
    } else {
      const data = await res.json();
      setError(JSON.stringify(data.error));
    }
  }

  if (categories.length === 0) {
    return <p className="text-slate">No expense categories yet — add one via the seed script or settings.</p>;
  }

  return (
    <div className="max-w-xl">
      <h1 className="font-display text-2xl mb-6">Add expense</h1>
      <form onSubmit={handleSubmit} className="card space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Category</label>
            <select className="input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Amount</label>
            <input type="number" step="0.01" className="input" value={amount} onChange={(e) => setAmount(e.target.value)} required />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Date</label>
            <input type="date" className="input" value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} />
          </div>
          <div>
            <label className="label">Payment method</label>
            <select className="input" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
              {["BANK_TRANSFER", "UPI", "CHEQUE", "CASH", "CARD", "OTHER"].map((m) => (
                <option key={m} value={m}>{m.replace("_", " ")}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="label">Vendor</label>
          <input className="input" value={vendorName} onChange={(e) => setVendorName(e.target.value)} />
        </div>
        <div>
          <label className="label">Description</label>
          <textarea className="input" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        {error && <div className="text-sm text-danger bg-dangerSoft rounded-md px-3 py-2">{error}</div>}
        <button type="submit" disabled={saving} className="btn-primary">{saving ? "Saving…" : "Save expense"}</button>
      </form>
    </div>
  );
}
