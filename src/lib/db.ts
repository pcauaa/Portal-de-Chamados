import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

/**
 * Instancia unica do Prisma Client.
 *
 * A partir do Prisma 7 a conexao e feita por um driver adapter (pg nativo) em
 * vez do motor Rust embutido - por isso a connection string e injetada aqui, e
 * nao declarada no schema.prisma.
 *
 * O cache no globalThis existe por causa do hot reload do Next.js em
 * desenvolvimento: sem ele, cada alteracao de arquivo criaria um novo
 * PrismaClient com um novo pool de conexoes, ate o Postgres recusar novas
 * conexoes ("too many clients already"). Em producao o modulo e carregado uma
 * unica vez e o cache nao entra em jogo.
 */

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL nao definida. Copie .env.example para .env e preencha a conexao.",
  );
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
