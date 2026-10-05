"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createClient, updateClient } from "@/server/services/client-service";
import { createProject, updateProject } from "@/server/services/project-service";
import { createScheduleStage, updateScheduleStage, updateScheduleStageStatus } from "@/server/services/schedule-service";
import { createProjectPayment, updateProjectPayment } from "@/server/services/payment-service";
import { saveBriefingResponses } from "@/server/services/briefing-service";
import { finishBriefing, reopenBriefing } from "@/server/services/briefing-service";
import { removeVisualOption, saveVisualOption } from "@/server/services/briefing-service";
import { requireProjectAccess, requireRole } from "@/server/auth";
import { DomainError } from "@/server/errors";
import { createBriefingLink, revokeBriefingLink, getBriefingLinkStatus } from "@/server/services/briefing-link-service";
import { finishBriefingByToken, saveBriefingResponsesByToken } from "@/server/services/briefing-service";
import { updateReportVisibility } from "@/server/services/report-visibility-service";
import { archiveProjectDocument, uploadProjectDocument } from "@/server/services/document-service";
import { createProposal, createProposalLink, decideProposal, generateContract, getProposalReadiness, listProposals, saveProposalPresentation, saveProposalVersion, sendProposalEmail, sendProposalWhatsApp } from "@/server/services/proposal-service";
import { listContractTemplates, listMessageTemplates, updateContractTemplate, updateMessageTemplate } from "@/server/services/message-template-service";
import { listNotificationEvents } from "@/server/services/notification-service";
import {
  listCommercialPackages,
  listServiceCatalog,
  replacePackageItems,
  updateServiceItem,
} from "@/server/services/service-catalog-service";
import { advanceSignatureStatus, requestContractSignature } from "@/server/services/signature-service";
import { convertApprovedProposal, getConversionReadiness } from "@/server/services/conversion-service";
import { listAuditTrail } from "@/server/audit";
import { resolveClientKey } from "@/lib/proposal-access";
import type { SignatureStatusName } from "@/lib/signature";

export async function saveClientAction(input: unknown) {
  await requireRole("ADMIN");
  const result = await createClient(input);
  revalidatePath("/admin/clientes");
  revalidatePath("/admin");
  return result;
}

export async function editClientAction(id: string, input: unknown) {
  await requireRole("ADMIN");
  const result = await updateClient(id, input);
  revalidatePath("/admin/clientes");
  revalidatePath(`/admin/clientes/${id}`);
  revalidatePath("/admin");
  return result;
}

export async function saveProjectAction(input: unknown) {
  await requireRole("ADMIN");
  const result = await createProject(input);
  revalidatePath("/admin/projetos");
  revalidatePath("/admin");
  return result;
}

export async function editProjectAction(id: string, input: unknown) {
  await requireRole("ADMIN");
  const result = await updateProject(id, input);
  revalidatePath("/admin/projetos");
  revalidatePath(`/admin/projetos/${id}`);
  revalidatePath("/admin");
  return result;
}

export async function saveScheduleStageAction(input: unknown) {
  await requireRole("ADMIN");
  const result = await createScheduleStage(input);
  revalidatePath("/admin/projetos");
  revalidatePath("/admin");
  return result;
}

/**
 * Tópico 3 — transição de estado de uma etapa.
 *
 * A autorização fica no serviço (`updateScheduleStageStatus`), que também valida
 * a transição e a dependência pendente. Aqui só se revalida a página e se
 * traduz o resultado para a interface — o frontend nunca decide sozinho.
 */
export async function moveStageStatusAction(stageId: string, status: string) {
  try {
    await requireRole("ADMIN");
    await updateScheduleStageStatus(stageId, status);
    revalidatePath("/admin/projetos");
    revalidatePath("/admin");
    return { ok: true as const };
  } catch (error) {
    return {
      ok: false as const,
      message:
        error instanceof DomainError
          ? error.message
          : "Não foi possível mudar o estado da etapa.",
    };
  }
}

export async function editScheduleStageAction(id: string, input: unknown) {
  await requireRole("ADMIN");
  const result = await updateScheduleStage(id, input);
  revalidatePath("/admin/projetos");
  revalidatePath("/admin");
  return result;
}

export async function savePaymentAction(input: unknown) {
  await requireRole("ADMIN");
  const result = await createProjectPayment(input);
  revalidatePath("/admin/projetos");
  revalidatePath("/admin");
  return result;
}

export async function editPaymentAction(projectId: string, id: string, input: unknown) {
  await requireRole("ADMIN");
  const result = await updateProjectPayment(projectId, id, input);
  revalidatePath("/admin/projetos");
  revalidatePath(`/admin/projetos/${projectId}`);
  revalidatePath("/admin");
  return result;
}

export async function saveBriefingAction(projectId: string, input: unknown) {
  await requireProjectAccess(projectId);
  const result = await saveBriefingResponses(projectId, input);
  revalidatePath(`/admin/projetos/${projectId}`);
  revalidatePath(`/portal/${projectId}`);
  return result;
}

export async function finishBriefingAction(projectId: string) {
  const result = await finishBriefing(projectId);
  revalidatePath(`/portal/${projectId}/briefing`);
  return result;
}

export async function reopenBriefingAction(projectId: string) {
  const result = await reopenBriefing(projectId);
  revalidatePath(`/portal/${projectId}/briefing`);
  return result;
}

export async function saveBriefingVisualOptionAction(input: Parameters<typeof saveVisualOption>[0]) {
  // Tópico 35 — o formulário público do briefing também é CLIENT; estas opções
  // são configuração editorial do ADMIN e não podem ser alteradas por qualquer
  // usuário autenticado.
  await requireRole("ADMIN");
  return saveVisualOption(input);
}

export async function removeBriefingVisualOptionAction(id: string) {
  await requireRole("ADMIN");
  return removeVisualOption(id);
}

export async function createBriefingLinkAction(projectId: string) {
  const result = await createBriefingLink(projectId);
  revalidatePath(`/admin/projetos/${projectId}`);
  return result;
}

export async function revokeBriefingLinkAction(projectId: string) {
  const result = await revokeBriefingLink(projectId);
  revalidatePath(`/admin/projetos/${projectId}`);
  return result;
}

export async function getBriefingLinkStatusAction(projectId: string) {
  return getBriefingLinkStatus(projectId);
}

export async function saveBriefingTokenAction(token: string, input: unknown) {
  return saveBriefingResponsesByToken(token, input);
}

export async function finishBriefingTokenAction(token: string) {
  return finishBriefingByToken(token);
}

export async function updateReportVisibilityAction(projectId: string, reportId: string, status: "PREPARING" | "INTERNAL" | "RELEASED" | "ARCHIVED") {
  const result = await updateReportVisibility(projectId, reportId, status);
  revalidatePath(`/admin/projetos/${projectId}`);
  revalidatePath(`/portal/${projectId}`);
  return result;
}

export async function uploadProjectDocumentAction(projectId: string, formData: FormData) {
  const file = formData.get("file");
  const visibility = formData.get("visibility");
  if (!file || typeof file !== "object" || !("arrayBuffer" in file) || (visibility !== "INTERNAL" && visibility !== "CLIENT")) throw new Error("Arquivo ou visibilidade inválidos.");
  const result = await uploadProjectDocument(projectId, file as { name: string; size: number; type: string; arrayBuffer(): Promise<ArrayBuffer> }, visibility);
  revalidatePath(`/admin/projetos/${projectId}`);
  revalidatePath(`/portal/${projectId}`);
  return result;
}

export async function archiveProjectDocumentAction(projectId: string, documentId: string) {
  const result = await archiveProjectDocument(documentId);
  revalidatePath(`/admin/projetos/${projectId}`);
  revalidatePath(`/portal/${projectId}`);
  return result;
}

export async function createProposalAction(projectId: string) {
  const result = await createProposal(projectId);
  revalidatePath("/admin/propostas");
  revalidatePath(`/admin/projetos/${projectId}`);
  return result;
}

export async function createProposalLinkAction(proposalId: string) {
  const result = await createProposalLink(proposalId);
  revalidatePath("/admin/propostas");
  return result;
}

export async function saveProposalVersionAction(proposalId: string, input: Parameters<typeof saveProposalVersion>[1]) {
  const result = await saveProposalVersion(proposalId, input);
  revalidatePath("/admin/propostas");
  revalidatePath(`/admin/propostas/${proposalId}`);
  return result;
}

/**
 * FASE 4C — gravar a apresentação (item 9).
 *
 * É a ÚNICA porta de entrada do editor visual. Deliberadamente separada de
 * `saveProposalVersionAction`: essa grava os valores e cria uma versão nova,
 * esta grava só as páginas. Misturá-las faria cada legenda corrigida virar um
 * novo orçamento para o cliente.
 */
export async function saveProposalPresentationAction(proposalId: string, presentation: unknown) {
  const result = await saveProposalPresentation(proposalId, presentation);
  revalidatePath(`/admin/propostas/${proposalId}`);
  return result;
}

/**
 * FASE 4C — a guarda de publicação para o editor (item 64).
 *
 * Devolve a MESMA avaliação que o servidor vai fazer no envio. O editor mostra-a
 * antes de o ADMIN clicar, para que a recusa não chegue como surpresa.
 */
export async function getProposalReadinessAction(proposalId: string) {
  return getProposalReadiness(proposalId);
}

export async function listProposalsAction() {
  return listProposals();
}

export async function decideProposalTokenAction(token: string, decision: "APPROVED" | "REJECTED") {
  // Tópico 23: registra as evidências técnicas disponíveis no momento da decisão.
  const requestHeaders = await headers();
  const ip =
    requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    requestHeaders.get("x-real-ip") ??
    null;
  // Tópico 35: a origem é obrigatória. Sem ela a aprovação do cliente ficaria
  // sem rate limit — o bypass que esta alteração corrige.
  const clientKey = resolveClientKey(requestHeaders);
  const evidence = {
    ip,
    userAgent: requestHeaders.get("user-agent") ?? null,
  };
  return decideProposal(token, decision, evidence, clientKey);
}

export async function listMessageTemplatesAction() {
  return listMessageTemplates();
}

export async function updateMessageTemplateAction(key: string, input: { name?: string; body: string }) {
  const result = await updateMessageTemplate(key, input);
  revalidatePath("/admin/mensagens");
  return result;
}

export async function listContractTemplatesAction() {
  return listContractTemplates();
}

export async function updateContractTemplateAction(
  id: string,
  input: { name?: string; body: string; clauses: unknown },
) {
  const result = await updateContractTemplate(id, input);
  revalidatePath("/admin/mensagens");
  return result;
}

export async function listNotificationEventsAction(entityId: string) {
  return listNotificationEvents(entityId);
}

export async function requestContractSignatureAction(contractId: string) {
  const result = await requestContractSignature(contractId);
  revalidatePath("/admin/propostas");
  return result;
}

export async function advanceSignatureAction(contractId: string, status: SignatureStatusName) {
  const result = await advanceSignatureStatus(contractId, status);
  revalidatePath("/admin/propostas");
  return result;
}

export async function listServiceCatalogAction() {
  return listServiceCatalog({ includeInactive: true });
}

export async function updateServicePricingAction(
  id: string,
  input: { baseLow?: number; baseMedium?: number; baseHigh?: number; active?: boolean; reason?: string },
) {
  const result = await updateServiceItem(id, input);
  revalidatePath("/admin/servicos");
  return result;
}

export async function listCommercialPackagesAction() {
  return listCommercialPackages();
}

export async function replacePackageItemsAction(packageId: string, serviceIds: string[]) {
  const result = await replacePackageItems(packageId, serviceIds);
  revalidatePath("/admin/servicos");
  return result;
}
export async function sendProposalWhatsAppAction(proposalId: string) {
  const result = await sendProposalWhatsApp(proposalId);
  revalidatePath(`/admin/propostas/${proposalId}`);
  revalidatePath("/admin/propostas");
  return result;
}

/**
 * FASE 4D — envio por E-MAIL (item 42).
 *
 * Chama `sendProposalEmail`, que já usa o Communication Engine e o `MessageTemplate`
 * existente. Este action não monta mensagem nenhuma: a variable de cada item vive
 * no template e no serviço, e é lá que a validação acontece.
 */
export async function sendProposalEmailAction(proposalId: string) {
  const result = await sendProposalEmail(proposalId);
  revalidatePath(`/admin/propostas/${proposalId}`);
  return result;
}

export async function generateContractAction(proposalId: string) {
  const result = await generateContract(proposalId);
  revalidatePath(`/admin/propostas/${proposalId}`);
  return result;
}

/**
 * Tópico 37 — dispara a conversão. A autorização é feita no serviço
 * (`requireRole("ADMIN")`), não aqui: o ID recebido do frontend nunca é
 * tratado como prova de acesso.
 */
export async function convertProposalAction(proposalId: string) {
  const result = await convertApprovedProposal(proposalId);
  revalidatePath(`/admin/propostas/${proposalId}`);
  revalidatePath("/admin/propostas");
  revalidatePath(`/admin/projetos/${result.projectId}`);
  return result;
}

/** Tópico 37 — mostra o que impede a conversão, sem executá-la. */
export async function getConversionReadinessAction(proposalId: string) {
  return getConversionReadiness(proposalId);
}

/** Tópico 36 — trilha de auditoria de uma entidade comercial. */
export async function listAuditTrailAction(entity: string, entityId: string) {
  await requireRole("ADMIN");
  return listAuditTrail(entity, entityId);
}

