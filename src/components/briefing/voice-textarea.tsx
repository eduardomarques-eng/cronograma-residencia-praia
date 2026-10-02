"use client";

import { useEffect, useRef, useState } from "react";

type SpeechAlternative = { transcript: string };
type SpeechResult = { isFinal: boolean; length: number; [index: number]: SpeechAlternative };
type SpeechEvent = { resultIndex: number; results: { length: number; [index: number]: SpeechResult } };
type SpeechErrorEvent = { error: string };
type SpeechRecognitionInstance = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onend: (() => void) | null;
  onerror: ((event: SpeechErrorEvent) => void) | null;
  onresult: ((event: SpeechEvent) => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};
type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;
type SpeechWindow = typeof globalThis & { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor };

type Props = {
  value: string;
  onChange: (value: string) => void;
  rows: number;
  label: string;
};

export function VoiceTextarea({ value, onChange, rows, label }: Props) {
  const recognition = useRef<SpeechRecognitionInstance | null>(null);
  const baseText = useRef(value);
  const [interimText, setInterimText] = useState("");
  const [state, setState] = useState<"ready" | "requesting" | "recording" | "transcribing" | "paused" | "done" | "error" | "unsupported">("ready");
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    const speechWindow = globalThis as SpeechWindow;
    setSupported(Boolean(speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition));
    return () => {
      recognition.current?.abort();
      recognition.current = null;
    };
  }, []);

  function startRecognition() {
    const speechWindow = globalThis as SpeechWindow;
    const Constructor = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    if (!Constructor) {
      setSupported(false);
      setState("unsupported");
      return;
    }
    baseText.current = value;
    setState("requesting");
    const instance = new Constructor();
    instance.continuous = true;
    instance.interimResults = true;
    instance.lang = "pt-BR";
    instance.onresult = (event) => {
      let finalText = "";
      let currentInterim = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        if (result.isFinal) finalText += result[0].transcript;
        else currentInterim += result[0].transcript;
      }
      if (finalText.trim()) {
        const next = `${baseText.current}${baseText.current && !/\s$/.test(baseText.current) ? " " : ""}${finalText.trim()}`;
        baseText.current = next;
        onChange(next);
      }
      setInterimText(currentInterim);
      setState(currentInterim ? "transcribing" : "recording");
    };
    instance.onerror = (event) => {
      setInterimText("");
      setState(event.error === "not-allowed" || event.error === "service-not-allowed" ? "error" : "error");
    };
    instance.onend = () => {
      recognition.current = null;
      setInterimText("");
      setState((current) => current === "paused" || current === "ready" ? current : current === "error" ? "error" : "done");
    };
    recognition.current = instance;
    try {
      instance.start();
      setState("recording");
    } catch {
      setState("error");
      recognition.current = null;
    }
  }

  function pauseRecognition() {
    recognition.current?.stop();
    setState("paused");
  }

  function cancelRecognition() {
    recognition.current?.abort();
    recognition.current = null;
    setInterimText("");
    setState("ready");
  }

  const displayValue = `${value}${interimText ? `${value && !/\s$/.test(value) ? " " : ""}${interimText}` : ""}`;
  const statusMessage = state === "requesting" ? "Solicitando microfone…" : state === "recording" ? "Gravando…" : state === "transcribing" ? "Transcrevendo…" : state === "paused" ? "Pausado. Toque no microfone para continuar." : state === "done" ? "Transcrição concluída; revise o texto." : state === "error" ? "Não foi possível acessar o microfone. Você pode continuar digitando." : state === "unsupported" || !supported ? "Transcrição por voz não está disponível neste navegador." : "";

  const isRecording = state === "recording" || state === "transcribing";
  return <div className="relative"><textarea aria-label={label} value={displayValue} onChange={(event) => { setInterimText(""); baseText.current = event.target.value; onChange(event.target.value); }} rows={rows} className="min-h-24 w-full resize-y rounded-2xl border border-slate-200 bg-white p-4 pr-14 text-base outline-none transition focus:border-blue-500" /><div className="absolute right-3 top-3 flex items-center gap-1"><button type="button" aria-label={isRecording ? "Pausar transcrição por voz" : "Iniciar transcrição por voz"} title={supported ? "Responder por voz" : "Transcrição por voz indisponível"} disabled={!supported || state === "requesting"} onClick={isRecording ? pauseRecognition : startRecognition} className={`flex size-10 items-center justify-center rounded-full text-lg transition focus:outline-none focus:ring-2 focus:ring-blue-500 ${isRecording ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-600 hover:bg-blue-100 hover:text-blue-700"} disabled:cursor-not-allowed disabled:opacity-50`}>{isRecording ? "Ⅱ" : "🎙"}</button>{(isRecording || state === "paused") && <button type="button" aria-label="Cancelar transcrição por voz" onClick={cancelRecognition} className="flex size-10 items-center justify-center rounded-full bg-slate-100 text-sm text-slate-500 hover:bg-rose-100 hover:text-rose-700">×</button>}</div>{statusMessage && <p className={`mt-2 text-xs ${state === "error" || state === "unsupported" ? "text-rose-700" : "text-slate-500"}`} role="status">{statusMessage}</p>}</div>;
}
