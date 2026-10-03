import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { SectionHeading } from "@/components/section-heading";
import { ContractTemplateEditor, MessageTemplateEditor } from "@/components/proposals/template-editors";
import { listContractTemplates, listMessageTemplates } from "@/server/services/message-template-service";
import { WHATSAPP_VARIABLES } from "@/lib/whatsapp";
import { CONTRACT_CLAUSE_SECTIONS, CONTRACT_VARIABLES } from "@/lib/contract-template";

export const dynamic = "force-dynamic";

export default async function AdminMessagesPage() {
  const [templates, contractTemplates] = await Promise.all([listMessageTemplates(), listContractTemplates()]);
  return (
    <AppShell eyebrow="Configuração">
      <SectionHeading
        title="Mensagens e contratos"
        description="Templates editáveis pelo ADMIN. O sistema apenas substitui variáveis; o texto é de responsabilidade do estúdio."
      />
      <Card className="mt-6">
        <h2 className="text-xl font-bold text-slate-950">Mensagens de WhatsApp</h2>
        <p className="mt-1 text-sm text-slate-500">Variáveis marcadas com * são obrigatórias para o envio.</p>
        <div className="mt-5">
          <MessageTemplateEditor templates={templates} variables={WHATSAPP_VARIABLES} />
        </div>
      </Card>
      <Card className="mt-6">
        <h2 className="text-xl font-bold text-slate-950">Templates contratuais</h2>
        <p className="mt-1 text-sm text-slate-500">
          Estrutura normalizada: {CONTRACT_CLAUSE_SECTIONS.map((section) => section.title).join(" · ")}.
        </p>
        <div className="mt-5">
          <ContractTemplateEditor templates={contractTemplates} variables={CONTRACT_VARIABLES} />
        </div>
      </Card>
    </AppShell>
  );
}