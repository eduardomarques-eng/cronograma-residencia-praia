/**
 * Tópico 4A — Áudio: o ADAPTADOR de transcrição.
 *
 * A auditoria encontrou que o projecto NÃO tem integração de transcrição
 * configurada. O `VoiceTextarea` que existia não é transcrição: é a Web Speech
 * API do browser, que transcreve para texto no cliente e não guarda áudio nem
 * deixa ninguém rever o resultado depois.
 *
 * Este módulo define a INTERFACE e uma implementação honesta: sem provider
 * configurado, diz que não transcreve. Não inventa texto, não devolve uma
 * string vazia a fingir que transcreveu, e nunca marca a nota como
 * `TRANSCRIBED` sem texto real.
 *
 * `TRANSCRIPTION_PROVIDER` aceita `manual` (nenhum serviço externo; o cliente
 * escreve o que disse) ou `http` (um serviço próprio já existente na
 * infraestrutura do estúdio).
 */

export type TranscriptionResult =
  | { ok: true; provider: string; text: string }
  | { ok: false; provider: string; reason: string };

export interface TranscriptionProvider {
  readonly name: string;
  transcribe(input: { bytes: Buffer; mimeType: string; fileName: string }): Promise<TranscriptionResult>;
}

/**
 * Sem serviço externo: devolve o áudio intacto para o cliente escrever.
 *
 * A falha é explícita e não é uma excepção — o fluxo do cliente tem de continuar
 * mesmo sem transcrição, porque o áudio já está guardado e pode ser ouvido.
 */
class ManualTranscriptionProvider implements TranscriptionProvider {
  readonly name = "manual";

  async transcribe(): Promise<TranscriptionResult> {
    return {
      ok: false,
      provider: this.name,
      reason: "Sem serviço de transcrição configurado. O áudio foi guardado e pode ouvir-se; escreva o que disse.",
    };
  }
}

/**
 * Serviço HTTP próprio do estúdio.
 *
 * Só é usado quando `TRANSCRIPTION_ENDPOINT` está definido. A resposta
 * esperada é `{ "text": "..." }`. Qualquer falha — rede, timeout, formato —
 * devolve `ok: false` com o motivo, e o áudio continua guardado.
 */
class HttpTranscriptionProvider implements TranscriptionProvider {
  readonly name = "http";

  constructor(private readonly endpoint: string, private readonly apiKey?: string) {}

  async transcribe(input: {
    bytes: Buffer;
    mimeType: string;
    fileName: string;
  }): Promise<TranscriptionResult> {
    const controller = new AbortController();
    // Sem limite, um serviço que não responde bloqueia o cliente indefinidamente.
    const timeout = setTimeout(() => controller.abort(), 30_000);
    try {
      const form = new FormData();
      // `Uint8Array` e não `Buffer`: os tipos do DOM aceitam a primeira e
      // rejeitam a segunda, apesar de os bytes serem os mesmos.
      form.append(
        "file",
        new Blob([new Uint8Array(input.bytes)], { type: input.mimeType }),
        input.fileName,
      );
      const response = await fetch(this.endpoint, {
        method: "POST",
        body: form,
        signal: controller.signal,
        headers: this.apiKey ? { authorization: `Bearer ${this.apiKey}` } : undefined,
      });
      if (!response.ok) {
        return { ok: false, provider: this.name, reason: `Serviço de transcrição respondeu ${response.status}.` };
      }
      const payload: unknown = await response.json();
      const text =
        payload && typeof payload === "object" && "text" in payload
          ? String((payload as { text: unknown }).text ?? "").trim()
          : "";
      if (!text) {
        return { ok: false, provider: this.name, reason: "Serviço de transcrição devolveu texto vazio." };
      }
      return { ok: true, provider: this.name, text };
    } catch (error) {
      return {
        ok: false,
        provider: this.name,
        reason: error instanceof Error ? error.message : "Falha ao transcrever o áudio.",
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}

/** O provider configurado, ou o manual quando não há nenhum. */
export function transcriptionProvider(): TranscriptionProvider {
  const endpoint = process.env.TRANSCRIPTION_ENDPOINT;
  if (endpoint) return new HttpTranscriptionProvider(endpoint, process.env.TRANSCRIPTION_API_KEY);
  return new ManualTranscriptionProvider();
}