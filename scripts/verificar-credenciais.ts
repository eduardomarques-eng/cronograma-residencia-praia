/**
 * Prova de credenciais e de papeis — ferramenta de diagnostico local.
 *
 * Corre contra a base provisionada por `provisionar-credenciais.mjs`. Confirma:
 *   1. as contas ADMIN e OPERADOR existem com o papel correcto;
 *   2. a senha de cada uma valida com `verifyPassword` — a MESMA funcao do login;
 *   3. as regras de papel: quem opera o cronograma e quem NAO acede ao comercial.
 *
 * Uso: npx tsx scripts/verificar-credenciais.ts
 */
import { PrismaClient } from "@prisma/client";
import { verifyPassword } from "../src/lib/password";
import { canOperateSchedule } from "../src/lib/schedule-roles";

const prisma = new PrismaClient();

const CONTAS = [
  { email: process.env.SEED_ADMIN_EMAIL ?? "dono@arqvertice.com", senha: process.env.SEED_ADMIN_PASSWORD ?? "Dono@2026Arq", papel: "ADMIN" },
  { email: process.env.SEED_OPERADOR_EMAIL ?? "equipe@arqvertice.com", senha: process.env.SEED_OPERADOR_PASSWORD ?? "Equipe@2026Arq", papel: "OPERADOR" },
];

let falhas = 0;

async function main() {
  for (const conta of CONTAS) {
    const email = conta.email.trim().toLowerCase();
    const user = await prisma.user.findUnique({ where: { email }, select: { email: true, role: true, passwordHash: true } });
    if (!user) {
      console.error(`  [X] ${email}: utilizador NAO existe`);
      falhas++;
      continue;
    }
    const papelOk = user.role === conta.papel;
    const senhaOk = verifyPassword(conta.senha, user.passwordHash);
    console.log(`  [${papelOk && senhaOk ? "OK" : "X"}] ${email} — papel=${user.role} (esperado ${conta.papel}) | login=${senhaOk ? "valido" : "FALHOU"}`);
    if (!papelOk || !senhaOk) falhas++;
  }

  // Regras de papel (dominio puro).
  const regras = [
    { role: "ADMIN", opera: true },
    { role: "OPERADOR", opera: true },
    { role: "CLIENT", opera: false },
  ];
  for (const r of regras) {
    const got = canOperateSchedule(r.role);
    const ok = got === r.opera;
    console.log(`  [${ok ? "OK" : "X"}] canOperateSchedule(${r.role}) = ${got} (esperado ${r.opera})`);
    if (!ok) falhas++;
  }

  if (falhas > 0) {
    console.error(`\n[verificar] ${falhas} verificacao(oes) falharam.`);
    process.exitCode = 1;
    return;
  }
  console.log("\n[verificar] Todas as credenciais e papeis conferem.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
