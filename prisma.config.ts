import "dotenv/config";
import { defineConfig } from "prisma/config";

/**
 * Configuracao do Prisma CLI (migrate, generate, studio, seed).
 *
 * A partir do Prisma 7 a connection string nao pode mais ficar no
 * schema.prisma. Ela e declarada aqui para o CLI, e injetada na aplicacao pelo
 * driver adapter em src/lib/db.ts. Ambos leem a MESMA variavel DATABASE_URL, o
 * que evita o cenario em que migration e aplicacao apontam para bancos
 * diferentes sem ninguem perceber.
 *
 * O `import "dotenv/config"` acima e o que carrega o .env para o CLI - o
 * Next.js carrega o mesmo arquivo por conta propria.
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
