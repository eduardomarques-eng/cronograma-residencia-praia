import { Suspense } from "react";
import { RedefinirSenhaForm } from "./form";

export default async function RedefinirSenhaPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  // O token é lido no servidor, não no browser: `window.location` num
  // componente de cliente provoca mismatch de hidratação.
  const raw = (await searchParams).token;
  const token = (Array.isArray(raw) ? raw[0] : raw) ?? "";

  return (
    <Suspense fallback={null}>
      <RedefinirSenhaForm token={token} />
    </Suspense>
  );
}