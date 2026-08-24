import "dotenv/config";
import { randomBytes } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Priority } from "../src/generated/prisma/client";
import { hashPassword } from "../src/lib/auth/password";
import {
  ALL_PERMISSIONS,
  PERMISSION_DESCRIPTIONS,
  ROLE_NAMES,
  ROLE_PERMISSIONS,
  ROLES,
  type RoleSlug,
} from "../src/config/permissions";

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

/**
 * Seed do portal de chamados.
 *
 * E idempotente (upsert em tudo): rodar de novo atualiza o catalogo sem
 * duplicar nada e sem tocar nos chamados ja existentes. Isso importa porque o
 * seed tambem e o mecanismo de atualizar permissoes quando uma nova e criada.
 */

const DEPARTAMENTOS = [
  "Diretoria",
  "Financeiro",
  "Comercial",
  "Compras",
  "Recursos Humanos",
  "Producao",
  "Logistica",
  "TI",
];

const CATEGORIAS = [
  {
    name: "Computador",
    slug: "computador",
    description: "Nao liga, lentidao, travamentos, tela azul, periféricos.",
    icon: "monitor",
    color: "#2563eb",
    defaultPriority: Priority.MEDIA,
    slaHours: 8,
  },
  {
    name: "Impressora",
    slug: "impressora",
    description: "Nao imprime, atolamento, sem toner, erro de fila.",
    icon: "printer",
    color: "#7c3aed",
    defaultPriority: Priority.MEDIA,
    slaHours: 8,
  },
  {
    name: "Internet",
    slug: "internet",
    description: "Sem conexao, lentidao, site ou servico inacessivel.",
    icon: "wifi",
    color: "#0891b2",
    defaultPriority: Priority.ALTA,
    slaHours: 4,
  },
  {
    name: "Sistema ERP",
    slug: "erp",
    description: "Erro, lentidao ou duvida no sistema de gestao.",
    icon: "database",
    color: "#ea580c",
    defaultPriority: Priority.ALTA,
    slaHours: 4,
  },
  {
    name: "E-mail",
    slug: "email",
    description: "Nao recebe ou nao envia, caixa cheia, spam, assinatura.",
    icon: "mail",
    color: "#dc2626",
    defaultPriority: Priority.MEDIA,
    slaHours: 8,
  },
  {
    name: "Rede",
    slug: "rede",
    description: "Pastas compartilhadas, servidor, VPN, permissoes de acesso.",
    icon: "network",
    color: "#0d9488",
    defaultPriority: Priority.ALTA,
    slaHours: 4,
  },
  {
    name: "Telefonia",
    slug: "telefonia",
    description: "Ramal mudo, sem linha, configuracao de aparelho.",
    icon: "phone",
    color: "#16a34a",
    defaultPriority: Priority.MEDIA,
    slaHours: 8,
  },
  {
    name: "Equipamentos",
    slug: "equipamentos",
    description: "Solicitacao, troca ou manutencao de equipamento.",
    icon: "hard-drive",
    color: "#ca8a04",
    defaultPriority: Priority.BAIXA,
    slaHours: 24,
  },
  {
    name: "Solicitacao de acesso",
    slug: "solicitacao-de-acesso",
    description: "Novo usuario, permissao em sistema, redefinicao de senha.",
    icon: "key-round",
    color: "#db2777",
    defaultPriority: Priority.MEDIA,
    slaHours: 8,
  },
  {
    name: "Outros",
    slug: "outros",
    description: "Nao se encaixa nas demais categorias.",
    icon: "circle-help",
    color: "#64748b",
    defaultPriority: Priority.BAIXA,
    slaHours: 24,
  },
];

/** Senha inicial: vem do ambiente ou e sorteada e impressa uma unica vez. */
function senhaInicial(): { valor: string; gerada: boolean } {
  const doAmbiente = process.env.SEED_ADMIN_PASSWORD;
  if (doAmbiente && doAmbiente.length >= 10) {
    return { valor: doAmbiente, gerada: false };
  }
  // base64url de 12 bytes -> 16 caracteres, sem ambiguidade de digitacao.
  return { valor: randomBytes(12).toString("base64url"), gerada: true };
}

async function main() {
  console.log("Populando o banco...\n");

  // --- Permissoes -----------------------------------------------------------
  for (const slug of ALL_PERMISSIONS) {
    await db.permission.upsert({
      where: { slug },
      update: { description: PERMISSION_DESCRIPTIONS[slug] },
      create: { slug, description: PERMISSION_DESCRIPTIONS[slug] },
    });
  }
  console.log(`  permissoes ......... ${ALL_PERMISSIONS.length}`);

  // --- Perfis e vinculo com as permissoes -----------------------------------
  for (const slug of Object.values(ROLES)) {
    const role = await db.role.upsert({
      where: { slug },
      update: { name: ROLE_NAMES[slug], isSystem: true },
      create: { slug, name: ROLE_NAMES[slug], isSystem: true },
    });

    const desejadas = ROLE_PERMISSIONS[slug as RoleSlug];
    const permissoes = await db.permission.findMany({
      where: { slug: { in: [...desejadas] } },
      select: { id: true },
    });

    // Reescreve o vinculo: garante que remover uma permissao do catalogo
    // tambem a remova do perfil, e nao apenas adicione as novas.
    await db.rolePermission.deleteMany({ where: { roleId: role.id } });
    await db.rolePermission.createMany({
      data: permissoes.map((p) => ({ roleId: role.id, permissionId: p.id })),
      skipDuplicates: true,
    });

    console.log(`  perfil ${slug.padEnd(12)} ${permissoes.length} permissoes`);
  }

  // --- Setores --------------------------------------------------------------
  for (const name of DEPARTAMENTOS) {
    await db.department.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }
  console.log(`  setores ............ ${DEPARTAMENTOS.length}`);

  // --- Categorias -----------------------------------------------------------
  for (const [indice, categoria] of CATEGORIAS.entries()) {
    await db.category.upsert({
      where: { slug: categoria.slug },
      update: { ...categoria, sortOrder: indice },
      create: { ...categoria, sortOrder: indice },
    });
  }
  console.log(`  categorias ......... ${CATEGORIAS.length}`);

  // --- Usuario administrador inicial ----------------------------------------
  const adminRole = await db.role.findUniqueOrThrow({
    where: { slug: ROLES.ADMIN },
  });
  const setorTi = await db.department.findUniqueOrThrow({ where: { name: "TI" } });

  const email = process.env.SEED_ADMIN_EMAIL ?? "admin@empresa.local";
  const jaExiste = await db.user.findUnique({ where: { email } });

  if (jaExiste) {
    console.log(`\n  admin .............. ja existe (${email}), senha preservada`);
  } else {
    const senha = senhaInicial();
    await db.user.create({
      data: {
        name: "Administrador",
        email,
        passwordHash: await hashPassword(senha.valor),
        roleId: adminRole.id,
        departmentId: setorTi.id,
      },
    });

    console.log("\n  ┌──────────────────────────────────────────────┐");
    console.log("  │  ACESSO INICIAL                              │");
    console.log("  ├──────────────────────────────────────────────┤");
    console.log(`  │  e-mail: ${email.padEnd(35)}│`);
    console.log(`  │  senha:  ${senha.valor.padEnd(35)}│`);
    console.log("  └──────────────────────────────────────────────┘");
    if (senha.gerada) {
      console.log("  (senha sorteada; defina SEED_ADMIN_PASSWORD para fixar)");
    }
  }

  console.log("\nSeed concluido.");
}

main()
  .catch((erro) => {
    console.error("Falha no seed:", erro);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
