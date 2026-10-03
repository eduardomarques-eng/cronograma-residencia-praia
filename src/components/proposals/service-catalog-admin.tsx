"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { replacePackageItemsAction, updateServicePricingAction } from "@/app/actions/domain-actions";
import { Button } from "@/components/ui/button";
import { UNIT_LABELS, type CatalogService } from "@/lib/pricing";

export type CatalogRow = CatalogService;

export type PackageRow = {
  id: string;
  name: string;
  description: string | null;
  items: Array<{ id: string; serviceId: string }>;
};

const inputClass = "min-h-10 w-full rounded-xl border border-slate-200 bg-white px-2 text-sm";

const LEVEL_FIELDS = [
  { key: "baseLow", label: "Baixo" },
  { key: "baseMedium", label: "Médio" },
  { key: "baseHigh", label: "Alto" },
] as const;

type PriceDraft = { baseLow: string; baseMedium: string; baseHigh: string; reason: string };

/** Tópicos 4 e 5 — cadastro e faixas comerciais; alteração sempre justificada. */
export function ServiceCatalogAdmin({ services }: { services: CatalogRow[] }) {
  const router = useRouter();
  const [drafts, setDrafts] = useState<Record<string, PriceDraft>>(() =>
    Object.fromEntries(
      services.map((service) => [
        service.id,
        {
          baseLow: String(service.baseLow),
          baseMedium: String(service.baseMedium),
          baseHigh: String(service.baseHigh),
          reason: "",
        },
      ]),
    ),
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const disciplines = Array.from(new Set(services.map((service) => service.discipline)));

  function patch(serviceId: string, field: keyof PriceDraft, value: string) {
    setDrafts((current) => ({ ...current, [serviceId]: { ...current[serviceId], [field]: value } }));
  }

  async function save(serviceId: string) {
    const draft = drafts[serviceId];
    setBusy(serviceId);
    setMessage("");
    try {
      await updateServicePricingAction(serviceId, {
        baseLow: Number(draft.baseLow),
        baseMedium: Number(draft.baseMedium),
        baseHigh: Number(draft.baseHigh),
        reason: draft.reason || undefined,
      });
      setMessage("Preços atualizados e registrados no histórico.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível salvar os preços.");
    } finally {
      setBusy(null);
    }
  }

  if (!services.length) {
    return <p className="text-sm text-slate-500">Catálogo vazio. Execute o seed ou cadastre serviços.</p>;
  }

  return (
    <div className="space-y-8">
      {disciplines.map((discipline) => (
        <div key={discipline}>
          <h3 className="font-semibold text-slate-900">{discipline}</h3>
          <div className="mt-3 space-y-3">
            {services
              .filter((service) => service.discipline === discipline)
              .map((service) => {
                const draft = drafts[service.id];
                return (
                  <div key={service.id} className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-900">{service.name}</p>
                      <p className="text-xs text-slate-500">
                        {UNIT_LABELS[service.unit] ?? service.unit} · v{service.version ?? 1} ·{" "}
                        {service.active === false ? "inativo" : "ativo"}
                        {service.estimatedDays ? ` · ${service.estimatedDays} dias` : ""}
                      </p>
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-3">
                      {LEVEL_FIELDS.map((field) => (
                        <label key={field.key} className="text-xs font-semibold text-slate-600">
                          {field.label}
                          <input
                            className={`${inputClass} mt-1`}
                            inputMode="decimal"
                            aria-label={`${field.label} — ${service.name}`}
                            value={draft[field.key]}
                            onChange={(event) => patch(service.id, field.key, event.target.value)}
                          />
                        </label>
                      ))}
                    </div>
                    <div className="mt-3 flex flex-wrap items-end gap-2">
                      <label className="min-w-64 flex-1 text-xs font-semibold text-slate-600">
                        Motivo da alteração (obrigatório)
                        <input
                          className={`${inputClass} mt-1`}
                          aria-label={`Motivo — ${service.name}`}
                          placeholder="Ex.: revisão anual de tabela"
                          value={draft.reason}
                          onChange={(event) => patch(service.id, "reason", event.target.value)}
                        />
                      </label>
                      <Button variant="secondary" onClick={() => save(service.id)} disabled={busy === service.id}>
                        {busy === service.id ? "Salvando…" : "Salvar preços"}
                      </Button>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      ))}
      {message ? <p className="text-sm font-semibold text-slate-700">{message}</p> : null}
    </div>
  );
}

/** Tópico 11 — composição de pacotes; os nomes vivem no banco. */
export function PackageEditor({ packages, services }: { packages: PackageRow[]; services: CatalogRow[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(packages.map((pack) => [pack.id, pack.items.map((item) => item.serviceId)])),
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  function toggle(packageId: string, serviceId: string) {
    setSelected((current) => {
      const list = current[packageId] ?? [];
      return {
        ...current,
        [packageId]: list.includes(serviceId) ? list.filter((id) => id !== serviceId) : [...list, serviceId],
      };
    });
  }

  async function save(packageId: string) {
    setBusy(packageId);
    setMessage("");
    try {
      await replacePackageItemsAction(packageId, selected[packageId] ?? []);
      setMessage("Composição do pacote atualizada.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível salvar o pacote.");
    } finally {
      setBusy(null);
    }
  }

  if (!packages.length) return <p className="text-sm text-slate-500">Nenhum pacote cadastrado.</p>;

  return (
    <div className="space-y-4">
      {packages.map((pack) => (
        <div key={pack.id} className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-semibold text-slate-900">{pack.name}</p>
          {pack.description ? <p className="text-xs text-slate-500">{pack.description}</p> : null}
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {services.map((service) => (
              <label key={service.id} className="flex items-center gap-2 text-xs text-slate-700">
                <input
                  type="checkbox"
                  checked={(selected[pack.id] ?? []).includes(service.id)}
                  onChange={() => toggle(pack.id, service.id)}
                />
                {service.name} <span className="text-slate-400">({service.discipline})</span>
              </label>
            ))}
          </div>
          <div className="mt-3">
            <Button variant="secondary" onClick={() => save(pack.id)} disabled={busy === pack.id}>
              {busy === pack.id ? "Salvando…" : "Salvar composição"}
            </Button>
          </div>
        </div>
      ))}
      {message ? <p className="text-sm font-semibold text-slate-700">{message}</p> : null}
    </div>
  );
}