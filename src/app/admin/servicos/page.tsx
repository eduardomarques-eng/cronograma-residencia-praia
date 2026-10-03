import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { SectionHeading } from "@/components/section-heading";
import { PackageEditor, ServiceCatalogAdmin } from "@/components/proposals/service-catalog-admin";
import { listCommercialPackages, listServiceCatalog } from "@/server/services/service-catalog-service";

export const dynamic = "force-dynamic";

export default async function AdminServicesPage() {
  const [services, packages] = await Promise.all([
    listServiceCatalog({ includeInactive: true }),
    listCommercialPackages(),
  ]);
  return (
    <AppShell eyebrow="Configuração">
      <SectionHeading
        title="Serviços e precificação"
        description="Preços vêm exclusivamente deste catálogo. Faixas Baixo/Médio/Alto são faixas comerciais definidas pelo ADMIN, não níveis de qualidade."
      />
      <Card className="mt-6">
        <h2 className="text-xl font-bold text-slate-950">Catálogo de serviços</h2>
        <p className="mt-1 text-sm text-slate-500">
          Toda alteração de preço exige motivo e é gravada no histórico. Valor em branco não é estimado pelo sistema.
        </p>
        <div className="mt-5">
          <ServiceCatalogAdmin services={services} />
        </div>
      </Card>
      <Card className="mt-6">
        <h2 className="text-xl font-bold text-slate-950">Pacotes comerciais</h2>
        <p className="mt-1 text-sm text-slate-500">Composição configurável. Os nomes não são fixos no código.</p>
        <div className="mt-5">
          <PackageEditor packages={packages} services={services} />
        </div>
      </Card>
    </AppShell>
  );
}