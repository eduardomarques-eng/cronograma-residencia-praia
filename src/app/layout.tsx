import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "ArqVértice Flow",
    template: "%s · ArqVértice Flow",
  },
  description: "Base moderna para gestão de projetos, obras e relacionamento com clientes.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
