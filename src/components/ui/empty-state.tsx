import type { ReactNode } from "react";
import { Card } from "./card";

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <Card className="border-dashed text-center">
      <div className="mx-auto max-w-md py-8">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-xl text-slate-500" aria-hidden="true">＋</div>
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
        {action ? <div className="mt-5">{action}</div> : null}
      </div>
    </Card>
  );
}
