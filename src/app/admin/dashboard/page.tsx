import { permanentRedirect } from "next/navigation";

/**
 * `/admin/dashboard` foi a primeira implementação do painel e passou a ser
 * `/admin`. Esta rota mantém os links antigos a funcionar, apontando para a
 * implementação canónica — uma só, sem duas telas iguais.
 */
export default function AdminDashboardAlias() {
  permanentRedirect("/admin");
}