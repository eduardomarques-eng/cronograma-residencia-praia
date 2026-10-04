import { permanentRedirect } from "next/navigation";

/**
 * As telas passaram para dentro de `/admin`. Esta rota mantém os links
 * antigos a funcionar em vez de os deixar morrer.
 */
export default function LegacyProjetos() {
  permanentRedirect("/admin/projetos");
}