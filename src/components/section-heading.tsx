import type { ReactNode } from "react";

export function SectionHeading({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><h1 className="text-3xl font-bold tracking-[-0.03em] text-slate-950">{title}</h1>{description ? <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">{description}</p> : null}</div>{action}</div>;
}
