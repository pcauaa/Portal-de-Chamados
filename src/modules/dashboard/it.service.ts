import "server-only";
import { db } from "@/lib/db";
import { TicketStatus, Priority } from "@/generated/prisma/enums";
import { APP_TIMEZONE } from "@/lib/datetime";

/**
 * Agregacoes do painel da TI.
 *
 * As contagens por dimensao usam groupBy do Prisma (uma consulta por
 * dimensao, agregada no banco). A serie mensal usa SQL cru porque precisa de
 * date_trunc COM fuso: as datas sao gravadas em UTC, e um chamado aberto as
 * 22h de 31/janeiro em Sao Paulo e 01/fevereiro em UTC - sem a conversao, ele
 * cairia no mes errado do relatorio.
 */

export type Period = { from: Date; to: Date };

export function defaultPeriod(): Period {
  const to = new Date();
  const from = new Date();
  from.setMonth(from.getMonth() - 11);
  from.setDate(1);
  from.setHours(0, 0, 0, 0);
  return { from, to };
}

export type ItDashboard = {
  counts: Record<TicketStatus, number>;
  totalPeriod: number;
  avgServiceSeconds: number | null;
  avgFirstResponseSeconds: number | null;
  reopenRate: number;
  byCategory: { label: string; value: number }[];
  byPriority: { priority: Priority; value: number }[];
  byRequester: { label: string; value: number }[];
  monthly: { month: string; abertos: number; finalizados: number }[];
  stalled: {
    number: number;
    title: string;
    status: TicketStatus;
    assigneeName: string | null;
    daysSinceUpdate: number;
  }[];
};

export async function getItDashboard(period: Period): Promise<ItDashboard> {
  const inPeriod = { openedAt: { gte: period.from, lte: period.to } };

  const [statusGroups, categoryGroups, priorityGroups, requesterGroups] =
    await Promise.all([
      db.ticket.groupBy({ by: ["status"], _count: true }),
      db.ticket.groupBy({ by: ["categoryId"], where: inPeriod, _count: true }),
      db.ticket.groupBy({ by: ["priority"], where: inPeriod, _count: true }),
      db.ticket.groupBy({ by: ["requesterId"], where: inPeriod, _count: true }),
    ]);

  const counts = Object.fromEntries(
    Object.values(TicketStatus).map((s) => [s, 0]),
  ) as Record<TicketStatus, number>;
  for (const group of statusGroups) counts[group.status] = group._count;

  // --- Nomes das dimensoes -------------------------------------------------
  const [categories, requesters] = await Promise.all([
    db.category.findMany({ select: { id: true, name: true } }),
    db.user.findMany({
      where: { id: { in: requesterGroups.map((g) => g.requesterId) } },
      select: { id: true, name: true },
    }),
  ]);
  const categoryName = new Map(categories.map((c) => [c.id, c.name]));
  const requesterName = new Map(requesters.map((u) => [u.id, u.name]));

  const byCategory = categoryGroups
    .map((g) => ({ label: categoryName.get(g.categoryId) ?? "?", value: g._count }))
    .filter((row) => row.value > 0)
    .sort((a, b) => b.value - a.value);

  const byPriority = Object.values(Priority).map((priority) => ({
    priority,
    value: priorityGroups.find((g) => g.priority === priority)?._count ?? 0,
  }));

  const byRequester = requesterGroups
    .map((g) => ({ label: requesterName.get(g.requesterId) ?? "?", value: g._count }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8); // acima disso o grafico vira lista ilegivel

  // --- Tempos medios -------------------------------------------------------
  // Calculado no banco: (fechamento - abertura) menos o tempo parado
  // aguardando o usuario. Sem esse desconto a metrica culparia a TI pela
  // demora do solicitante em responder.
  const [tempos] = await db.$queryRaw<
    { avg_service: number | null; avg_first_response: number | null }[]
  >`
    SELECT
      AVG(EXTRACT(EPOCH FROM (closed_at - opened_at)) - waiting_seconds)
        FILTER (WHERE closed_at IS NOT NULL)                       AS avg_service,
      AVG(EXTRACT(EPOCH FROM (first_response_at - opened_at)))
        FILTER (WHERE first_response_at IS NOT NULL)               AS avg_first_response
    FROM tickets
    WHERE opened_at >= ${period.from} AND opened_at <= ${period.to}
  `;

  const totalPeriod = await db.ticket.count({ where: inPeriod });
  const reopened = await db.ticket.count({
    where: { ...inPeriod, reopenedCount: { gt: 0 } },
  });

  // --- Serie mensal --------------------------------------------------------
  const monthlyRows = await db.$queryRaw<
    { mes: string; abertos: bigint; finalizados: bigint }[]
  >`
    SELECT
      to_char(date_trunc('month', opened_at AT TIME ZONE ${APP_TIMEZONE}), 'YYYY-MM') AS mes,
      count(*)                                                          AS abertos,
      count(*) FILTER (WHERE status = 'FINALIZADO')                     AS finalizados
    FROM tickets
    WHERE opened_at >= ${period.from} AND opened_at <= ${period.to}
    GROUP BY 1
    ORDER BY 1
  `;
  const monthly = monthlyRows.map((row) => ({
    month: row.mes,
    abertos: Number(row.abertos),
    finalizados: Number(row.finalizados),
  }));

  // --- Chamados parados ----------------------------------------------------
  // O widget que evita o chamado esquecido no fundo da fila.
  const threshold = new Date(Date.now() - 3 * 24 * 3600 * 1000);
  const stalledTickets = await db.ticket.findMany({
    where: {
      status: {
        in: [TicketStatus.ABERTO, TicketStatus.EM_ANDAMENTO, TicketStatus.AGUARDANDO_USUARIO],
      },
      updatedAt: { lt: threshold },
    },
    select: {
      number: true,
      title: true,
      status: true,
      updatedAt: true,
      assignee: { select: { name: true } },
    },
    orderBy: { updatedAt: "asc" },
    take: 8,
  });

  const stalled = stalledTickets.map((t) => ({
    number: t.number,
    title: t.title,
    status: t.status,
    assigneeName: t.assignee?.name ?? null,
    daysSinceUpdate: Math.floor(
      (Date.now() - t.updatedAt.getTime()) / (24 * 3600 * 1000),
    ),
  }));

  return {
    counts,
    totalPeriod,
    avgServiceSeconds: tempos?.avg_service != null ? Number(tempos.avg_service) : null,
    avgFirstResponseSeconds:
      tempos?.avg_first_response != null ? Number(tempos.avg_first_response) : null,
    reopenRate: totalPeriod > 0 ? reopened / totalPeriod : 0,
    byCategory,
    byPriority,
    byRequester,
    monthly,
    stalled,
  };
}
