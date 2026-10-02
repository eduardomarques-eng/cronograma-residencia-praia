"use server";

import { revalidatePath } from "next/cache";
import { createClient, updateClient } from "@/server/services/client-service";
import { createProject, updateProject } from "@/server/services/project-service";
import { createScheduleStage, updateScheduleStage } from "@/server/services/schedule-service";
import { createProjectPayment, updateProjectPayment } from "@/server/services/payment-service";
import { saveBriefingResponses } from "@/server/services/briefing-service";
import { requireProjectAccess, requireRole } from "@/server/auth";

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
