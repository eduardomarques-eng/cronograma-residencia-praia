"use client";

export function PrintButton() {
  return <button type="button" onClick={() => window.print()} className="print-hidden rounded-xl bg-[#1d1d1f] px-4 py-3 text-sm font-semibold text-white">Imprimir / PDF</button>;
}
