"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { saveProposalVersionAction } from "@/app/actions/domain-actions";
import { Button } from "@/components/ui/button";
import { DISCIPLINES } from "@/lib/commercial-scope";

type Slide = { title: string; body: string };
type ServiceRow = { name: string; discipline: string; unit: string; quantity: string; subtotal: string };

export type ProposalEditorData = {
  title: string;
  slides: Slide[];
  object: string;
  validityDays: number;
  conditions: string;
  services: ServiceRow[];
  adjustment: number;
  expiresAt: string;
};

const emptySlide: Slide = { title: "", body: "" };
const emptyService: ServiceRow = { name: "", discipline: "", unit: "un.", quantity: "1", subtotal: "0" };

function toNumber(value: string) {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function toCurrency(value: number) {
  return value.toFixed(2).replace(".", ",");
}

const inputClass =
  "min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500";

export function ProposalEditor({ proposalId, initial }: { proposalId: string; initial: ProposalEditorData }) {
  const router = useRouter();
  const [title, setTitle] = useState(initial.title);
  const [slides, setSlides] = useState<Slide[]>(initial.slides.length ? initial.slides : [emptySlide]);
  const [object, setObject] = useState(initial.object);
  const [validityDays, setValidityDays] = useState(String(initial.validityDays || 30));
  const [conditions, setConditions] = useState(initial.conditions);
  const [services, setServices] = useState<ServiceRow[]>(initial.services.length ? initial.services : [emptyService]);
  const [adjustment, setAdjustment] = useState(String(initial.adjustment ?? 0));
  const [expiresAt, setExpiresAt] = useState(initial.expiresAt);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const subtotal = useMemo(() => services.reduce((sum, service) => sum + toNumber(service.subtotal), 0), [services]);
  const total = subtotal + toNumber(adjustment);

  function updateSlide(index: number, patch: Partial<Slide>) {
    setSlides((current) => current.map((slide, i) => (i === index ? { ...slide, ...patch } : slide)));
  }

  function updateService(index: number, patch: Partial<ServiceRow>) {
    setServices((current) => current.map((service, i) => (i === index ? { ...service, ...patch } : service)));
  }

  async function save() {
    setStatus("saving");
    try {
      await saveProposalVersionAction(proposalId, {
        title: title.trim() || "Proposta comercial",
        presentation: { slides: slides.map((slide) => ({ title: slide.title.trim(), body: slide.body.trim() })) },
        formalText: { object: object.trim(), validityDays: Number(validityDays) || 30, conditions: conditions.trim() },
        services: services.map((service) => ({
          name: service.name.trim(),
          discipline: service.discipline,
          unit: service.unit.trim() || "un.",
          quantity: toNumber(service.quantity),
          subtotal: toNumber(service.subtotal),
        })),
        subtotal,
        adjustment: toNumber(adjustment),
        total,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      });
      setStatus("saved");
      router.refresh();
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <label htmlFor="proposal-title" className="text-sm font-semibold text-slate-700">Título da proposta</label>
        <input id="proposal-title" className={`${inputClass} mt-1`} value={title} onChange={(event) => setTitle(event.target.value)} />
      </div>

      <div>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-slate-900">Apresentação (slides)</h3>
          <Button variant="secondary" onClick={() => setSlides((current) => [...current, emptySlide])}>Adicionar slide</Button>
        </div>
        <div className="mt-3 space-y-3">
          {slides.map((slide, index) => (
            <div key={`slide-${index}`} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <input aria-label={`Título do slide ${index + 1}`} className={inputClass} value={slide.title} placeholder="Título do slide" onChange={(event) => updateSlide(index, { title: event.target.value })} />
              <textarea aria-label={`Texto do slide ${index + 1}`} className={`${inputClass} mt-2 min-h-20 py-2`} value={slide.body} placeholder="Texto do slide" onChange={(event) => updateSlide(index, { body: event.target.value })} />
              {slides.length > 1 ? <button type="button" className="mt-2 text-xs font-semibold text-rose-700" onClick={() => setSlides((current) => current.filter((_, i) => i !== index))}>Remover slide</button> : null}
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-slate-900">Escopo e investimento</h3>
          <Button variant="secondary" onClick={() => setServices((current) => [...current, emptyService])}>Adicionar serviço</Button>
        </div>
        <div className="mt-3 space-y-3">
          {services.map((service, index) => (
            <div key={`service-${index}`} className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-[2fr_1.4fr_1fr_1fr_1fr]">
              <input aria-label={`Serviço ${index + 1}`} className={inputClass} value={service.name} placeholder="Serviço" onChange={(event) => updateService(index, { name: event.target.value })} />
              <select
                aria-label={`Disciplina do serviço ${index + 1}`}
                className={inputClass}
                value={service.discipline}
                onChange={(event) => updateService(index, { discipline: event.target.value })}
              >
                <option value="">Disciplina…</option>
                {DISCIPLINES.map((discipline) => (
                  <option key={discipline} value={discipline}>{discipline}</option>
                ))}
              </select>
              <input aria-label={`Unidade ${index + 1}`} className={inputClass} value={service.unit} placeholder="un." onChange={(event) => updateService(index, { unit: event.target.value })} />
              <input aria-label={`Quantidade ${index + 1}`} className={inputClass} inputMode="decimal" value={service.quantity} placeholder="Quantidade" onChange={(event) => updateService(index, { quantity: event.target.value })} />
              <input aria-label={`Subtotal ${index + 1}`} className={inputClass} inputMode="decimal" value={service.subtotal} placeholder="Subtotal" onChange={(event) => updateService(index, { subtotal: event.target.value })} />
              {services.length > 1 ? <button type="button" className="text-xs font-semibold text-rose-700 sm:col-span-4" onClick={() => setServices((current) => current.filter((_, i) => i !== index))}>Remover serviço</button> : null}
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="proposal-object" className="text-sm font-semibold text-slate-700">Objeto da proposta</label>
          <input id="proposal-object" className={`${inputClass} mt-1`} value={object} onChange={(event) => setObject(event.target.value)} />
        </div>
        <div>
          <label htmlFor="proposal-validity" className="text-sm font-semibold text-slate-700">Validade (dias)</label>
          <input id="proposal-validity" className={`${inputClass} mt-1`} inputMode="numeric" value={validityDays} onChange={(event) => setValidityDays(event.target.value)} />
        </div>
        <div>
          <label htmlFor="proposal-conditions" className="text-sm font-semibold text-slate-700">Condições</label>
          <input id="proposal-conditions" className={`${inputClass} mt-1`} value={conditions} onChange={(event) => setConditions(event.target.value)} />
        </div>
        <div>
          <label htmlFor="proposal-expires" className="text-sm font-semibold text-slate-700">Expira em</label>
          <input id="proposal-expires" type="date" className={`${inputClass} mt-1`} value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} />
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between text-sm text-slate-600"><span>Subtotal</span><strong>R$ {toCurrency(subtotal)}</strong></div>
        <div className="mt-3 flex items-center justify-between gap-4 text-sm text-slate-600">
          <label htmlFor="proposal-adjustment">Ajuste</label>
          <input id="proposal-adjustment" className={`${inputClass} max-w-40`} inputMode="decimal" value={adjustment} onChange={(event) => setAdjustment(event.target.value)} />
        </div>
        <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-4 text-lg font-bold text-slate-950"><span>Total</span><span>R$ {toCurrency(total)}</span></div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={save} disabled={status === "saving"}>{status === "saving" ? "Salvando…" : "Salvar nova versão"}</Button>
        {status === "saved" ? <span className="text-sm font-semibold text-emerald-700">Nova versão criada.</span> : null}
        {status === "error" ? <span className="text-sm font-semibold text-rose-700">Não foi possível salvar. Propostas aprovadas ficam congeladas.</span> : null}
      </div>
    </div>
  );
}
