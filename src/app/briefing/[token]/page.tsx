import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/server/db";
import { getBriefingByToken } from "@/server/services/briefing-service";
import { answersOf } from "@/server/services/briefing-service";
import { GuidedBriefing } from "@/components/briefing/guided-briefing";

/**
 * Um briefing acedido por token é partilhado por e-mail. Nunca deve ser
 * indexado por um buscador: o token é a única autorização, e um índice
 * exponha o briefing de qualquer cliente a quem pesquisasse o nome do
 * estúdio. Só `noindex` — `nocache` não é uma directiva de robots válida.
 */
export const metadata: Metadata = {
  title: "Briefing",
  robots: { index: false },
};

export default async function PublicBriefingPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  try {
    const briefing = await getBriefingByToken(token);
    const visualOptions = await prisma.briefingVisualOption.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } });
    return (
      <main className="min-h-screen bg-[#f5f5f7] px-4 py-6 sm:px-8 sm:py-10">
        <div className="mx-auto max-w-3xl">
          <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-600">ArqVértice · Briefing</p>
            <h1 className="mt-2 text-xl font-bold text-slate-950">{briefing.project.name}</h1>
            <p className="mt-1 text-sm text-slate-500">Preparado para {briefing.project.client.name}</p>
          </div>
          <GuidedBriefing
            projectId={briefing.projectId}
            accessToken={token}
            initialResponses={answersOf(briefing)}
            initialStatus={briefing.status}
            initialVersion={briefing.version}
            persistedVisualOptions={visualOptions}
          />
        </div>
      </main>
    );
  } catch {
    notFound();
  }
}
