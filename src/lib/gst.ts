import { Prisma } from "@prisma/client";

const D = Prisma.Decimal;
export type Decimal = Prisma.Decimal;

export interface RawInvoiceItemInput {
  description: string;
  hsnSacCode: string;
  quantity: number | string;
  unitPrice: number | string;
  gstRate: number | string; // e.g. 18 for 18%
}

export interface ComputedInvoiceItem {
  description: string;
  hsnSacCode: string;
  quantity: Decimal;
  unitPrice: Decimal;
  gstRate: Decimal;
  taxableValue: Decimal;
  cgstAmount: Decimal;
  sgstAmount: Decimal;
  igstAmount: Decimal;
  lineTotal: Decimal;
  sortOrder: number;
}

export interface ComputedInvoiceTotals {
  items: ComputedInvoiceItem[];
  subtotal: Decimal;
  cgstTotal: Decimal;
  sgstTotal: Decimal;
  igstTotal: Decimal;
  grandTotal: Decimal;
}

/**
 * Computes per-line and invoice-level GST split.
 * isInterstate=true -> IGST only. isInterstate=false -> CGST+SGST split evenly.
 * All math done in Decimal to avoid floating point rounding errors, rounded
 * to 2dp only at the point of storage (never mid-calculation).
 */
export function computeInvoiceTotals(
  rawItems: RawInvoiceItemInput[],
  isInterstate: boolean
): ComputedInvoiceTotals {
  let subtotal = new D(0);
  let cgstTotal = new D(0);
  let sgstTotal = new D(0);
  let igstTotal = new D(0);

  const items: ComputedInvoiceItem[] = rawItems.map((raw, idx) => {
    const quantity = new D(raw.quantity);
    const unitPrice = new D(raw.unitPrice);
    const gstRate = new D(raw.gstRate);

    const taxableValue = quantity.mul(unitPrice).toDecimalPlaces(2);
    const totalTax = taxableValue.mul(gstRate).div(100).toDecimalPlaces(2);

    let cgstAmount = new D(0);
    let sgstAmount = new D(0);
    let igstAmount = new D(0);

    if (isInterstate) {
      igstAmount = totalTax;
    } else {
      cgstAmount = totalTax.div(2).toDecimalPlaces(2);
      sgstAmount = totalTax.sub(cgstAmount); // avoid rounding drift between the two halves
    }

    const lineTotal = taxableValue.add(cgstAmount).add(sgstAmount).add(igstAmount);

    subtotal = subtotal.add(taxableValue);
    cgstTotal = cgstTotal.add(cgstAmount);
    sgstTotal = sgstTotal.add(sgstAmount);
    igstTotal = igstTotal.add(igstAmount);

    return {
      description: raw.description,
      hsnSacCode: raw.hsnSacCode,
      quantity,
      unitPrice,
      gstRate,
      taxableValue,
      cgstAmount,
      sgstAmount,
      igstAmount,
      lineTotal,
      sortOrder: idx,
    };
  });

  const grandTotal = subtotal.add(cgstTotal).add(sgstTotal).add(igstTotal);

  return { items, subtotal, cgstTotal, sgstTotal, igstTotal, grandTotal };
}

/** Generates the next sequential invoice number for the current Indian financial year (Apr-Mar). */
export function currentFinancialYearLabel(date = new Date()): string {
  const year = date.getFullYear();
  const month = date.getMonth() + 1; // 1-12
  const fyStart = month >= 4 ? year : year - 1;
  const fyEndShort = String((fyStart + 1) % 100).padStart(2, "0");
  return `${fyStart}-${fyEndShort}`;
}

export function buildInvoiceNumber(prefix: string, fyLabel: string, sequence: number): string {
  return `${prefix}/${fyLabel}/${String(sequence).padStart(4, "0")}`;
}
