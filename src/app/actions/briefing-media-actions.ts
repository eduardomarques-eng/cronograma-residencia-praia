"use server";

/**
 * Tópico 4A — acções de MULTIMÉDIA do briefing.
 *
 * Existe em ficheiro próprio, e não dentro de `domain-actions.ts`, porque tem
 * de lidar com `File` e com o buffer dos ficheiros — e porque o caminho de
 * autorização é diferente: o cliente chega aqui pelo link público, onde o token
 * é a única prova.
 *
 * Nenhum ficheiro é gravado no disco local em produção: `putStoredObject` LANÇA
 * se o storage privado não estiver configurado, para o ficheiro não
 * desaparecer silenciosamente no primeiro deploy.
 *
 * O `token` do link público chega aqui como parte do pedido. NÃO é prova de
 * acesso por si só: o serviço resolve o token contra a base e compara-o com o
 * projecto. Um `projectId` alheio com um token válido não devolve nada — a
 * resposta é a mesma de um token inexistente.
 */
import { revalidatePath } from "next/cache";
import {
  addAudioNote,
  addReference,
  type BriefingAccess,
} from "@/server/services/briefing-media-service";
import { DomainError } from "@/server/errors";
import { ANSWER_KIND } from "@/lib/briefing-schema";

export type UploadMediaResult = {
  ok: boolean;
  message: string;
  transcript?: string;
};

function accessOf(projectId?: string, token?: string): BriefingAccess {
  if (token) return { kind: "TOKEN", token };
  if (!projectId) throw new DomainError("Projecto não indicado.", "VALIDATION");
  return { kind: "SESSION" };
}

export async function uploadBriefingMedia(input: {
  projectId?: string;
  token?: string;
  questionId: string;
  category: string;
  kind: typeof ANSWER_KIND.IMAGE_UPLOAD | typeof ANSWER_KIND.FILE | typeof ANSWER_KIND.AUDIO;
  file: File;
}): Promise<UploadMediaResult> {
  const access = accessOf(input.projectId, input.token);
  try {
    if (input.kind === ANSWER_KIND.AUDIO) {
      const note = await addAudioNote(access, input.projectId, {
        questionId: input.questionId,
        file: input.file,
      });
      if (input.projectId) revalidatePath(`/portal/${input.projectId}/briefing`);
      return {
        ok: true,
        transcript: note.transcript ?? undefined,
        message: note.transcript
          ? "Áudio guardado e transcrito. Corrija o texto antes de confirmar."
          : "Áudio guardado. Escreva abaixo o que disse.",
      };
    }

    await addReference(access, input.projectId, {
      questionId: input.questionId,
      file: input.file,
      category: input.category,
    });
    if (input.projectId) revalidatePath(`/portal/${input.projectId}/briefing`);
    return { ok: true, message: "Ficheiro guardado." };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof DomainError
          ? error.message
          : "Não foi possível enviar o ficheiro. Tente de novo.",
    };
  }
}