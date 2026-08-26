"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Customer } from "@prisma/client";

type OutstandingInvoice = {
  id: string;
  invoiceNumber: string;
  outstandingAmount: string;
  dueDate: string;
};

function inr(n: number) {
  return "₹ " + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function NewPaymentForm({
  customers,
  preselectedCustomerId,
  preselectedInvoiceId,
}: {
  customers: Customer[];
  preselectedCustomerId?: string;
  preselectedInvoiceId?: string;
}) {
  const router = useRouter();
  const [customerId, setCustomerId] = useState(preselectedCustomerId || customers[0]?.id || "");
  const [amount, setAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState("BANK_TRANSFER");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [invoices, setInvoices] = useState<OutstandingInvoice[]>([]);
  const [allocations, setAllocations] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!customerId) return;
    fetch(`/api/v1/customers/${customerId}`)
      .then((r) => r.json())
      .then((data) => {
        const outstanding = (data.invoices || []).filter(
          (i: any) => Number(i.outstandingAmount) > 0 && i.status !== "VOID"
        );
        setInvoices(outstanding);
        if (preselectedInvoiceId && outstanding.find((i: any) => i.id === preselectedInvoiceId)) {
          setAllocations({ [preselectedInvoiceId]: "" });
        }
      });
  }, [customerId]); // eslint-disable-line react-hooks/exhaustive-deps

  const allocatedTotal = useMemo(
    () => Object.values(allocations).reduce((s, v) => s + (Number(v) || 0), 0),
    [allocations]
  );

  function setAllocation(invoiceId: string, value: string) {
    setAllocations((prev) => ({ ...prev, [invoiceId]: value }));
  }

  function autoAllocate() {
    let remaining = Number(amount) || 0;
    const next: Record<string, string> = {};
    for (const inv of invoices) {
      if (remaining <= 0) break;
      const due = Number(inv.outstandingAmount);
      const take = Math.min(due, remaining);
      next[inv.id] = take.toFixed(2);
      remaining -= take;
    }
    setAllocations(next);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const allocList = Object.entries(allocations)
      .filter(([, v]) => Number(v) > 0)
      .map(([invoiceId, v]) => ({ invoiceId, amount: Number(v) }));

    if (allocList.length === 0) {
      setError("Allocate the payment to at least one invoice.");
      return;
    }
    setSaving(true);
    const res = await fetch("/api/v1/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerId, amount: Number(amount), paymentDate, method, referenceNumber, notes, allocations: allocList,
      }),
    });
    setSaving(false);
    if (res.ok) {
      router.push("/payments");
      router.refresh();
    } else {
      const data = await res.json();
      setError(data.error || "Failed to record payment.");
    }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="font-display text-2xl mb-6">Record payment</h1>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="card grid grid-cols-2 gap-4">
          <div>
            <label className="label">Customer</label>
            <select className="input" value={customerId} onChange={(e) => { setCustomerId(e.target.value); setAllocations({}); }}>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Amount received</label>
            <input type="number" step="0.01" className="input" value={amount} onChange={(e) => setAmount(e.target.value)} required />
          </div>
          <div>
            <label className="label">Payment date</label>
            <input type="date" className="input" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
          </div>
          <div>
            <label className="label">Method</label>
            <select className="input" value={method} onChange={(e) => setMethod(e.target.value)}>
              {["BANK_TRANSFER", "UPI", "CHEQUE", "CASH", "CARD", "OTHER"].map((m) => (
                <option key={m} value={m}>{m.replace("_", " ")}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Reference number</label>
            <input className="input" value={referenceNumber} onChange={(e) => setReferenceNumber(e.target.value)} placeholder="UTR / Cheque no." />
          </div>
          <div>
            <label className="label">Notes</label>
            <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-medium">Allocate to invoices</h2>
            <button type="button" onClick={autoAllocate} className="btn-secondary text-xs">Auto-allocate (oldest first)</button>
          </div>
          {invoices.length === 0 ? (
            <p className="text-sm text-slate">This customer has no outstanding invoices.</p>
          ) : (
            <table className="w-full table-shell">
              <thead><tr><th>Invoice</th><th>Due</th><th>Outstanding</th><th>Allocate</th></tr></thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id}>
                    <td>{inv.invoiceNumber}</td>
                    <td>{new Date(inv.dueDate).toLocaleDateString("en-IN")}</td>
                    <td>{inr(Number(inv.outstandingAmount))}</td>
                    <td>
                      <input
                        type="number" step="0.01" className="input"
                        value={allocations[inv.id] || ""}
                        onChange={(e) => setAllocation(inv.id, e.target.value)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div className="mt-3 text-sm flex justify-between border-t border-line pt-2">
            <span className="text-slate">Allocated total</span>
            <span className={allocatedTotal === Number(amount) ? "text-accent" : "text-warn"}>
              {inr(allocatedTotal)} / {inr(Number(amount) || 0)}
            </span>
          </div>
        </div>

        {error && <div className="text-sm text-danger bg-dangerSoft rounded-md px-3 py-2">{error}</div>}
        <button type="submit" disabled={saving} className="btn-primary">{saving ? "Recording…" : "Record payment"}</button>
      </form>
    </div>
  );
}
