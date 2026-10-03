"use server";

import { revalidatePath } from "next/cache";
import { createClient, updateClient } from "@/server/services/client-service";
import { createProject, updateProject } from "@/server/services/project-service";
import { createScheduleStage, updateScheduleStage } from "@/server/services/schedule-service";
import { createProjectPayment, updateProjectPayment } from "@/server/services/payment-service";
import { saveBriefingResponses } from "@/server/services/briefing-service";
import { finishBriefing, reopenBriefing } from "@/server/services/briefing-service";
import { removeVisualOption, saveVisualOption } from "@/server/services/briefing-service";
import { requireProjectAccess, requireRole } from "@/server/auth";
import { createBriefingLink, revokeBriefingLink, getBriefingLinkStatus } from "@/server/services/briefing-link-service";
import { finishBriefingByToken, saveBriefingResponsesByToken } from "@/server/services/briefing-service";
import { updateReportVisibility } from "@/server/services/report-visibility-service";
import { archiveProjectDocument, uploadProjectDocument } from "@/server/services/document-service";

export async function saveClientAction(input: unknown) {
  await requireRole("ADMIN");
  const result = await createClient(input);
  revalidatePath("/");
  return result;
}

export async function editClientAction(id: string, input: unknown) {
  await requireRole("ADMIN");
  const result = await updateClient(id, input);
  revalidatePath("/");
  return result;
}

export async function saveProjectAction(input: unknown) {
  await requireRole("ADMIN");
  const result = await createProject(input);
  revalidatePath("/");
  return result;
}

export async function editProjectAction(id: string, input: unknown) {
  await requireRole("ADMIN");
  const result = await updateProject(id, input);
  revalidatePath("/");
  return result;
}

export async function saveScheduleStageAction(input: unknown) {
  await requireRole("ADMIN");
  const result = await createScheduleStage(input);
  revalidatePath("/");
  return result;
}

export async function editScheduleStageAction(id: string, input: unknown) {
  await requireRole("ADMIN");
  const result = await updateScheduleStage(id, input);
  revalidatePath("/");
  return result;
}

export async function savePaymentAction(input: unknown) {
  await requireRole("ADMIN");
  const result = await createProjectPayment(input);
  revalidatePath("/");
  return result;
}

export async function editPaymentAction(projectId: string, id: string, input: unknown) {
  await requireRole("ADMIN");
  const result = await updateProjectPayment(projectId, id, input);
  revalidatePath("/");
  return result;
}

export async function saveBriefingAction(projectId: string, input: unknown) {
  await requireProjectAccess(projectId);
  const result = await saveBriefingResponses(projectId, input);
  revalidatePath("/");
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
  return saveVisualOption(input);
}

export async function removeBriefingVisualOptionAction(id: string) {
  return removeVisualOption(id);
}

export async function createBriefingLinkAction(projectId: string) {
  const result = await createBriefingLink(projectId);
  revalidatePath(`/projetos/${projectId}`);
  return result;
}

export async function revokeBriefingLinkAction(projectId: string) {
  const result = await revokeBriefingLink(projectId);
  revalidatePath(`/projetos/${projectId}`);
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
  revalidatePath(`/projetos/${projectId}`);
  revalidatePath(`/portal/${projectId}`);
  return result;
}

export async function uploadProjectDocumentAction(projectId: string, formData: FormData) {
  const file = formData.get("file");
  const visibility = formData.get("visibility");
  if (!file || typeof file !== "object" || !("arrayBuffer" in file) || (visibility !== "INTERNAL" && visibility !== "CLIENT")) throw new Error("Arquivo ou visibilidade inválidos.");
  const result = await uploadProjectDocument(projectId, file as { name: string; size: number; type: string; arrayBuffer(): Promise<ArrayBuffer> }, visibility);
  revalidatePath(`/projetos/${projectId}`);
  revalidatePath(`/portal/${projectId}`);
  return result;
}

export async function archiveProjectDocumentAction(projectId: string, documentId: string) {
  const result = await archiveProjectDocument(documentId);
  revalidatePath(`/projetos/${projectId}`);
  revalidatePath(`/portal/${projectId}`);
  return result;
}
