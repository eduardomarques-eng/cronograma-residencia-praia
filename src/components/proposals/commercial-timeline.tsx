import type { TimelineStep } from "@/lib/commercial-timeline";

const stateStyles: Record<TimelineStep["state"], string> = {
  DONE: "border-emerald-200 bg-emerald-50 text-emerald-800",
  CURRENT: "border-blue-300 bg-blue-50 text-blue-800",
  PENDING: "border-slate-200 bg-white text-slate-400",
};

function formatWhen(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("pt-BR");
}

/** Tópico 29 — linha do tempo comercial no ADMIN. */
export function CommercialTimeline({ steps }: { steps: TimelineStep[] }) {
  return (
    <ol className="space-y-2">
      {steps.map((step) => (
        <li
          key={step.key}
          className={`flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 ${stateStyles[step.state]}`}
        >
          <span className="text-[10px] font-bold uppercase tracking-widest">
            {step.state === "DONE" ? "OK" : step.state === "CURRENT" ? "agora" : "--"}
          </span>
          <span className="text-sm font-medium">{step.label}</span>
          <span className="ml-auto text-xs opacity-70">{formatWhen(step.at)}</span>
        </li>
      ))}
    </ol>
  );
}