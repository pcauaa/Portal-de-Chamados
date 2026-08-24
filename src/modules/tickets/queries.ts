import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { assertCan, can } from "@/lib/auth/guards";
import { notFound } from "@/lib/http/errors";
import { PERMISSIONS } from "@/config/permissions";
import type { SessionUser } from "@/lib/auth/session";
import type { ListTicketsQuery } from "./schemas";

/**
 * Consultas de chamados. Toda leitura de lista ou detalhe passa por aqui, e
 * NUNCA pela rota de API direto no Prisma - e o unico jeito de garantir que o
 * escopo (colaborador so ve os proprios chamados) seja aplicado sempre, e nao
 * "lembrado" em cada handler.
 */

const TICKET_LIST_INCLUDE = {
  category: { select: { id: true, name: true, icon: true, color: true } },
  requester: { select: { id: true, name: true } },
  assignee: { select: { id: true, name: true } },
} satisfies Prisma.TicketInclude;

const TICKET_DETAIL_INCLUDE = {
  category: true,
  requester: { select: { id: true, name: true, email: true, phone: true } },
  assignee: { select: { id: true, name: true, email: true } },
  department: true,
  closedBy: { select: { id: true, name: true } },
} satisfies Prisma.TicketInclude;

export type TicketListItem = Prisma.TicketGetPayload<{ include: typeof TICKET_LIST_INCLUDE }>;
export type TicketDetail = Prisma.TicketGetPayload<{ include: typeof TICKET_DETAIL_INCLUDE }>;

export type TicketListResult = {
  items: TicketListItem[];
  total: number;
  page: number;
  pageSize: number;
};

/**
 * Busca textual via o indice GIN criado na migration
 * `add_ticket_fulltext_index`. Fica isolada em $queryRaw (parametrizado, logo
 * seguro contra SQL Injection) porque o Prisma nao tem operador nativo de
 * full-text search para Postgres - o restante do filtro continua tipado.
 */
async function searchMatchingIds(query: string): Promise<string[]> {
  const rows = await db.$queryRaw<{ id: string }[]>`
    SELECT id FROM tickets
    WHERE to_tsvector('portuguese', title || ' ' || description)
      @@ plainto_tsquery('portuguese', ${query})
  `;
  return rows.map((row) => row.id);
}

function orderByFor(sort: ListTicketsQuery["sort"]): Prisma.TicketOrderByWithRelationInput[] {
  switch (sort) {
    case "antigos":
      return [{ openedAt: "asc" }];
    case "atualizados":
      return [{ updatedAt: "desc" }];
    case "prioridade":
      // Desempate por data: entre dois urgentes, o mais antigo vem primeiro -
      // e o que esta esperando ha mais tempo.
      return [{ priority: "desc" }, { openedAt: "asc" }];
    case "recentes":
    default:
      return [{ openedAt: "desc" }];
  }
}

export async function listTickets(
  user: SessionUser,
  filters: ListTicketsQuery,
): Promise<TicketListResult> {
  const canViewAll = can(user, PERMISSIONS.TICKET_VIEW_ALL);
  if (!canViewAll) {
    assertCan(user, PERMISSIONS.TICKET_VIEW_OWN);
  }

  const where: Prisma.TicketWhereInput = {
    // Escopo: sem TICKET_VIEW_ALL, o filtro de solicitante do proprio usuario
    // SEMPRE prevalece - um requesterId vindo da query string nao pode
    // ampliar o escopo, so restringi-lo ainda mais dentro do que ja e dele.
    ...(canViewAll ? {} : { requesterId: user.id }),
    ...(filters.status?.length ? { status: { in: filters.status } } : {}),
    ...(filters.priority?.length ? { priority: { in: filters.priority } } : {}),
    ...(filters.categoryId?.length ? { categoryId: { in: filters.categoryId } } : {}),
    ...(filters.unassigned
      ? { assigneeId: null }
      : filters.assigneeId
        ? { assigneeId: filters.assigneeId }
        : {}),
    ...(canViewAll && filters.requesterId ? { requesterId: filters.requesterId } : {}),
    ...(filters.departmentId ? { departmentId: filters.departmentId } : {}),
    ...(filters.from || filters.to
      ? {
          openedAt: {
            ...(filters.from ? { gte: filters.from } : {}),
            ...(filters.to ? { lte: filters.to } : {}),
          },
        }
      : {}),
  };

  if (filters.q?.trim()) {
    const ids = await searchMatchingIds(filters.q.trim());
    if (ids.length === 0) {
      return { items: [], total: 0, page: filters.page, pageSize: filters.pageSize };
    }
    where.id = { in: ids };
  }

  // Sequencial, nao em $transaction: as duas leituras nao precisam de
  // consistencia atomica entre si (um chamado criado no meio da paginacao so
  // deixa o total desatualizado por um instante, o que se corrige sozinho na
  // proxima pagina), e a forma em array do $transaction com o driver adapter
  // do pg reserva uma unica conexao para as duas queries, que passam a
  // disputa-la em paralelo - o driver acusa "already executing a query".
  const items = await db.ticket.findMany({
    where,
    include: TICKET_LIST_INCLUDE,
    orderBy: orderByFor(filters.sort),
    skip: (filters.page - 1) * filters.pageSize,
    take: filters.pageSize,
  });
  const total = await db.ticket.count({ where });

  return { items, total, page: filters.page, pageSize: filters.pageSize };
}

/**
 * Busca um chamado pelo numero, com escopo aplicado.
 *
 * Chamado inexistente e chamado de outra pessoa retornam o MESMO erro
 * (NOT_FOUND). Diferenciar os dois casos ("nao existe" vs "sem permissao")
 * revelaria, a quem esta testando numeros ao acaso, quais numeros de chamado
 * sao validos.
 */
export async function getTicketByNumber(
  user: SessionUser,
  number: number,
): Promise<TicketDetail> {
  const ticket = await db.ticket.findUnique({
    where: { number },
    include: TICKET_DETAIL_INCLUDE,
  });
  if (!ticket) throw notFound("Chamado");

  const canViewAll = can(user, PERMISSIONS.TICKET_VIEW_ALL);
  if (!canViewAll && ticket.requesterId !== user.id) {
    throw notFound("Chamado");
  }

  return ticket;
}

/** Entradas de historico de um chamado, para a timeline. */
export async function listTicketHistory(ticketId: string) {
  return db.ticketHistory.findMany({
    where: { ticketId },
    select: {
      id: true,
      eventType: true,
      field: true,
      oldValue: true,
      newValue: true,
      metadata: true,
      createdAt: true,
      actor: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "asc" },
  });
}

export type TicketHistoryEntry = Awaited<ReturnType<typeof listTicketHistory>>[number];

/** Anexos enviados na abertura (nao vinculados a um comentario). */
export async function listTicketAttachments(ticketId: string) {
  return db.attachment.findMany({
    where: { ticketId, commentId: null },
    select: {
      id: true,
      originalName: true,
      mimeType: true,
      sizeBytes: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });
}

/** Tecnicos ativos, para o seletor de responsavel. */
export async function listTechnicians() {
  return db.user.findMany({
    where: {
      isActive: true,
      role: { slug: { in: ["tecnico", "admin"] } },
    },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}
