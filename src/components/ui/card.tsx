import type { ReactNode } from "react";

export function Card({ children, className = "", id }: { children: ReactNode; className?: string; id?: string }) {
  return <section id={id} className={`surface rounded-2xl p-5 ${className}`}>{children}</section>;
}
