import Link from "next/link";
import { requirePageProjectAccess } from "@/server/auth";
import { prisma } from "@/server/db";
import { GuidedBriefing } from "@/components/briefing/guided-briefing";
import { answersOf } from "@/server/services/briefing-service";

export default async function BriefingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requirePageProjectAccess(id);
  const briefing = await prisma.briefing.upsert({
    where: { projectId: id },
    create: { projectId: id, responses: {} },
    update: {},
  });
  const visualOptions = await prisma.briefingVisualOption.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } });
  return (
    <main className="min-h-screen bg-[#f5f5f7] px-4 py-6 sm:px-8 sm:py-10">
      <div className="mx-auto max-w-3xl">
        <Link href={`/portal/${id}`} className="text-sm font-semibold text-blue-600">
          ← Voltar ao projeto
        </Link>
        <div className="mt-6">
          <GuidedBriefing
            projectId={id}
            initialResponses={answersOf(briefing)}
            initialStatus={briefing.status}
            initialVersion={briefing.version}
            persistedVisualOptions={visualOptions}
            backHref={`/portal/${id}`}
          />
        </div>
      </div>
    </main>
  );
}
