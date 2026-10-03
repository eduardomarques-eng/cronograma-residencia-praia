"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateContractTemplateAction, updateMessageTemplateAction } from "@/app/actions/domain-actions";
import { Button } from "@/components/ui/button";

export type MessageTemplateRow = {
  id: string;
  key: string;
  channel: string;
  name: string;
  body: string;
  version: number;
  active: boolean;
};

export type ContractTemplateRow = {
  id: string;
  name: string;
  body: string;
  clauses: unknown;
  version: number;
  isDefault: boolean;
};

export type TemplateVariable = { key: string; label: string; required: boolean };

const textareaClass =
  "min-h-40 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono text-xs leading-5 text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500";

function VariableHint({ variables }: { variables: ReadonlyArray<TemplateVariable> }) {
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {variables.map((variable) => (
        <span
          key={variable.key}
          className="rounded-lg bg-slate-100 px-2 py-1 text-[11px] text-slate-600"
          title={variable.label}
        >
          {`{{${variable.key}}}`}
          {variable.required ? " *" : ""}
        </span>
      ))}
    </div>
  );
}

function toDrafts(rows: Array<{ id: string; body: string }>): Record<string, string> {
  return rows.reduce<Record<string, string>>((accumulator, row) => {
    accumulator[row.id] = row.body;
    return accumulator;
  }, {});
}

export function MessageTemplateEditor({
  templates,
  variables,
}: {
  templates: MessageTemplateRow[];
  variables: ReadonlyArray<TemplateVariable>;
}) {
  const router = useRouter();
  const [drafts, setDrafts] = useState<Record<string, string>>(() => toDrafts(templates));
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  async function save(template: MessageTemplateRow) {
    setBusy(template.key);
    setMessage("");
    try {
      await updateMessageTemplateAction(template.key, { body: drafts[template.id] ?? template.body });
      setMessage(`Template “${template.name}” atualizado.`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível salvar o template.");
    } finally {
      setBusy(null);
    }
  }

  if (!templates.length) {
    return (
      <p className="text-sm text-slate-500">Nenhum template cadastrado. Execute o seed para provisionar os templates padrão.</p>
    );
  }

  return (
    <div className="space-y-6">
      {templates.map((template) => (
        <div key={template.id}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold text-slate-900">{template.name}</h3>
              <p className="text-xs text-slate-500">
                {template.channel} · chave {template.key} · versão {template.version} · {template.active ? "ativo" : "inativo"}
              </p>
            </div>
            <Button variant="secondary" onClick={() => save(template)} disabled={busy === template.key}>
              {busy === template.key ? "Salvando…" : "Salvar"}
            </Button>
          </div>
          <textarea
            aria-label={`Mensagem de ${template.name}`}
            className={`${textareaClass} mt-3`}
            value={drafts[template.id] ?? ""}
            onChange={(event) => setDrafts((current) => ({ ...current, [template.id]: event.target.value }))}
          />
          <VariableHint variables={variables} />
        </div>
      ))}
      {message ? <p className="text-sm font-semibold text-slate-700">{message}</p> : null}
    </div>
  );
}

export function ContractTemplateEditor({
  templates,
  variables,
}: {
  templates: ContractTemplateRow[];
  variables: ReadonlyArray<TemplateVariable>;
}) {
  const router = useRouter();
  const [drafts, setDrafts] = useState<Record<string, string>>(() => toDrafts(templates));
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  async function save(template: ContractTemplateRow) {
    setBusy(template.id);
    setMessage("");
    try {
      await updateContractTemplateAction(template.id, {
        body: drafts[template.id] ?? template.body,
        clauses: template.clauses,
      });
      setMessage(`Template contratual “${template.name}” atualizado.`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível salvar o template.");
    } finally {
      setBusy(null);
    }
  }

  if (!templates.length) {
    return (
      <p className="text-sm text-slate-500">
        Nenhum template contratual cadastrado. Execute o seed para criar a estrutura de cláusulas; o texto jurídico é
        preenchido pelo ADMIN.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {templates.map((template) => (
        <div key={template.id}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold text-slate-900">{template.name}</h3>
              <p className="text-xs text-slate-500">
                versão {template.version} · {template.isDefault ? "padrão" : "secundário"}
              </p>
            </div>
            <Button variant="secondary" onClick={() => save(template)} disabled={busy === template.id}>
              {busy === template.id ? "Salvando…" : "Salvar"}
            </Button>
          </div>
          <textarea
            aria-label={`Template contratual ${template.name}`}
            className={`${textareaClass} mt-3 min-h-64`}
            value={drafts[template.id] ?? ""}
            onChange={(event) => setDrafts((current) => ({ ...current, [template.id]: event.target.value }))}
          />
          <VariableHint variables={variables} />
        </div>
      ))}
      {message ? <p className="text-sm font-semibold text-slate-700">{message}</p> : null}
    </div>
  );
}