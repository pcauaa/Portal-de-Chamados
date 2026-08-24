import "server-only";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

/**
 * Consulta do log de auditoria.
 *
 * Registra eventos do SISTEMA (login, gestao de usuarios, download de anexo),
 * distintos do historico do chamado. Publico diferente (o admin) e politica de
 * retencao diferente - por isso vivem em tabelas separadas.
 */

export type AuditFilters = {
  eventType?: string;
  actorId?: string;
  page: number;
  pageSize: number;
};

export async function listAuditLogs(filters: AuditFilters) {
  const where: Prisma.AuditLogWhereInput = {
    ...(filters.eventType ? { eventType: filters.eventType } : {}),
    ...(filters.actorId ? { actorId: filters.actorId } : {}),
  };

  const items = await db.auditLog.findMany({
    where,
    select: {
      id: true,
      eventType: true,
      targetType: true,
      targetId: true,
      ipAddress: true,
      metadata: true,
      createdAt: true,
      actor: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
    skip: (filters.page - 1) * filters.pageSize,
    take: filters.pageSize,
  });

  const total = await db.auditLog.count({ where });

  return { items, total };
}

export type AuditEntry = Awaited<ReturnType<typeof listAuditLogs>>["items"][number];

/** Tipos de evento presentes no log, para montar o filtro sem chutar valores. */
export async function listAuditEventTypes(): Promise<string[]> {
  const rows = await db.auditLog.groupBy({
    by: ["eventType"],
    orderBy: { eventType: "asc" },
  });
  return rows.map((r) => r.eventType);
}

/** Quem ja apareceu no log - alimenta o filtro por autor. */
export async function listAuditActors() {
  const rows = await db.auditLog.groupBy({
    by: ["actorId"],
    where: { actorId: { not: null } },
  });
  const ids = rows.map((r) => r.actorId).filter((id): id is string => id !== null);

  return db.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

/** Rotulos legiveis - o admin nao deveria precisar decorar "user.password_reset". */
export const AUDIT_LABELS: Record<string, string> = {
  "login.success": "Login realizado",
  "login.failed": "Tentativa de login falhou",
  "login.blocked": "Login bloqueado (conta travada)",
  "login.inactive": "Login de conta desativada",
  "password.changed": "Senha alterada pelo proprio usuario",
  "user.created": "Usuario criado",
  "user.updated": "Usuario alterado",
  "user.activated": "Usuario reativado",
  "user.deactivated": "Usuario desativado",
  "user.password_reset": "Senha redefinida (sorteada) pelo admin",
  "user.password_set": "Senha definida pelo admin",
  "user.unlocked": "Conta destravada",
  "category.created": "Categoria criada",
  "category.updated": "Categoria alterada",
  "category.activated": "Categoria reativada",
  "category.deactivated": "Categoria desativada",
  "department.created": "Setor criado",
  "department.updated": "Setor alterado",
  "department.activated": "Setor reativado",
  "department.deactivated": "Setor desativado",
  "attachment.downloaded": "Anexo baixado",
};

export function auditLabel(eventType: string): string {
  return AUDIT_LABELS[eventType] ?? eventType;
}

/** Eventos que merecem destaque visual por indicarem risco. */
export function isSecurityEvent(eventType: string): boolean {
  return (
    eventType === "login.failed" ||
    eventType === "login.blocked" ||
    eventType === "login.inactive" ||
    eventType === "user.password_reset" ||
    eventType === "user.password_set" ||
    eventType === "user.deactivated"
  );
}
