"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Customer } from "@prisma/client";

type Item = { description: string; hsnSacCode: string; quantity: string; unitPrice: string; gstRate: string };

const emptyItem: Item = { description: "", hsnSacCode: "", quantity: "1", unitPrice: "0", gstRate: "18" };

function inr(n: number) {
  return "₹ " + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function NewInvoiceForm({ customers, homeStateCode }: { customers: Customer[]; homeStateCode: string }) {
  const router = useRouter();
  const [customerId, setCustomerId] = useState(customers[0]?.id || "");
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState(
    new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10)
  );
  const [notes, setNotes] = useState("");
  const [terms, setTerms] = useState("Payment due within 15 days of invoice date.");
  const [items, setItems] = useState<Item[]>([{ ...emptyItem }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const selectedCustomer = customers.find((c) => c.id === customerId);
  const isInterstate = selectedCustomer ? selectedCustomer.stateCode !== homeStateCode : false;

  const totals = useMemo(() => {
    let subtotal = 0, tax = 0;
    for (const it of items) {
      const qty = Number(it.quantity) || 0;
      const price = Number(it.unitPrice) || 0;
      const rate = Number(it.gstRate) || 0;
      const line = qty * price;
      subtotal += line;
      tax += (line * rate) / 100;
    }
    return { subtotal, tax, grand: subtotal + tax };
  }, [items]);

  function updateItem(idx: number, patch: Partial<Item>) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }
  function addItem() {
    setItems((prev) => [...prev, { ...emptyItem }]);
  }
  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const payload = {
      customerId,
      invoiceDate,
      dueDate,
      placeOfSupply: selectedCustomer?.state || "",
      isInterstate,
      notes,
      terms,
      items: items.map((it) => ({
        description: it.description,
        hsnSacCode: it.hsnSacCode,
        quantity: Number(it.quantity),
        unitPrice: Number(it.unitPrice),
        gstRate: Number(it.gstRate),
      })),
    };
    const res = await fetch("/api/v1/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (res.ok) {
      const invoice = await res.json();
      router.push(`/invoices/${invoice.id}`);
    } else {
      const data = await res.json();
      setError(JSON.stringify(data.error));
    }
  }

  if (customers.length === 0) {
    return <p className="text-slate">Add a customer first before creating an invoice.</p>;
  }

  return (
    <div className="max-w-3xl">
      <h1 className="font-display text-2xl mb-6">New invoice</h1>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="card grid grid-cols-2 gap-4">
          <div>
            <label className="label">Customer</label>
            <select className="input" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.name} — {c.state}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Tax type</label>
            <div className="input bg-mist">{isInterstate ? "IGST (inter-state)" : "CGST + SGST (intra-state)"}</div>
          </div>
          <div>
            <label className="label">Invoice date</label>
            <input type="date" className="input" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
          </div>
          <div>
            <label className="label">Due date</label>
            <input type="date" className="input" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-medium">Line items</h2>
            <button type="button" onClick={addItem} className="btn-secondary text-xs">+ Add line</button>
          </div>
          <div className="space-y-3">
            {items.map((it, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-end border-b border-line pb-3">
                <div className="col-span-4">
                  <label className="label">Description</label>
                  <input className="input" value={it.description} onChange={(e) => updateItem(idx, { description: e.target.value })} required />
                </div>
                <div className="col-span-2">
                  <label className="label">HSN/SAC</label>
                  <input className="input" value={it.hsnSacCode} onChange={(e) => updateItem(idx, { hsnSacCode: e.target.value })} required />
                </div>
                <div className="col-span-1">
                  <label className="label">Qty</label>
                  <input type="number" step="0.01" className="input" value={it.quantity} onChange={(e) => updateItem(idx, { quantity: e.target.value })} />
                </div>
                <div className="col-span-2">
                  <label className="label">Rate (₹)</label>
                  <input type="number" step="0.01" className="input" value={it.unitPrice} onChange={(e) => updateItem(idx, { unitPrice: e.target.value })} />
                </div>
                <div className="col-span-2">
                  <label className="label">GST %</label>
                  <input type="number" step="0.01" className="input" value={it.gstRate} onChange={(e) => updateItem(idx, { gstRate: e.target.value })} />
                </div>
                <div className="col-span-1 text-right">
                  {items.length > 1 && (
                    <button type="button" onClick={() => removeItem(idx)} className="text-danger text-xs">Remove</button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 ml-auto w-64 space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-slate">Subtotal</span><span>{inr(totals.subtotal)}</span></div>
            <div className="flex justify-between"><span className="text-slate">GST</span><span>{inr(totals.tax)}</span></div>
            <div className="flex justify-between font-medium text-base border-t border-line pt-1 mt-1"><span>Grand Total</span><span>{inr(totals.grand)}</span></div>
          </div>
        </div>

        <div className="card grid grid-cols-2 gap-4">
          <div>
            <label className="label">Notes</label>
            <textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <div>
            <label className="label">Terms</label>
            <textarea className="input" rows={2} value={terms} onChange={(e) => setTerms(e.target.value)} />
          </div>
        </div>

        {error && <div className="text-sm text-danger bg-dangerSoft rounded-md px-3 py-2">{error}</div>}
        <button type="submit" disabled={saving} className="btn-primary">{saving ? "Creating…" : "Create invoice"}</button>
      </form>
    </div>
  );
}
