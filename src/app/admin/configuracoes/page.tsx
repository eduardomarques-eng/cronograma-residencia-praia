import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { SectionHeading } from "@/components/section-heading";
import { requirePageRole } from "@/server/auth";

export const metadata = { title: "Configurações" };
export const dynamic = "force-dynamic";

/**
 * Configurações — apenas atalhos para áreas que JÁ têm backend.
 *
 * O schema não tem entidade de preferências de utilizador, por isso não se
 * promete aqui nada que não possa ser guardado. Cada destino aponta para uma
 * tela real e funcional.
 */
const AREAS = [
  { href: "/admin/servicos", label: "Serviços e preços", description: "Catálogo de serviços, itens e histórico de preços." },
  { href: "/admin/mensagens", label: "Mensagens", description: "Templates de WhatsApp e comunicação com o cliente." },
  { href: "/admin/briefing", label: "Briefings", description: "Links seguros de briefing e estado de cada um." },
] as const;

export default async function ConfiguracoesPage() {
  await requirePageRole("ADMIN");

  return (
    <AppShell eyebrow="Estúdio">
      <SectionHeading
        title="Configurações"
        description="As áreas que o estúdio configura hoje. Cada uma abre a tela que já existe e funciona."
      />

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {AREAS.map((area) => (
          <Card key={area.href}>
            <Link href={area.href} className="font-semibold text-slate-900 hover:text-blue-700">
              {area.label}
            </Link>
            <p className="mt-2 text-sm leading-6 text-slate-500">{area.description}</p>
          </Card>
        ))}
      </div>

      <p className="mt-8 text-sm leading-6 text-slate-500">
        Os dados da empresa (nome legal, documento, templates de contrato) vivem em variáveis de ambiente — ver{" "}
        <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">.env.example</code>. Como o modelo não tem tabela de
        preferências de utilizador, essa secção não aparece aqui.
      </p>
    </AppShell>
  );
}