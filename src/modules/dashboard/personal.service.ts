import "server-only";
import { db } from "@/lib/db";
import { TicketStatus } from "@/generated/prisma/enums";
import { OPEN_STATUSES } from "@/config/status";

/**
 * Painel do colaborador: apenas os chamados dele.
 *
 * O escopo e fechado por requesterId em todas as consultas - nao existe
 * caminho aqui que devolva chamado de outra pessoa.
 */
export type PersonalDashboard = {
  total: number;
  abertos: number;
  emAndamento: number;
  aguardandoResposta: number;
  finalizados: number;
  recent: {
    number: number;
    title: string;
    status: TicketStatus;
    openedAt: Date;
    categoryName: string;
    categoryIcon: string;
  }[];
};

export async function getPersonalDashboard(userId: string): Promise<PersonalDashboard> {
  const mine = { requesterId: userId };

  const [groups, total, recentTickets] = await Promise.all([
    db.ticket.groupBy({ by: ["status"], where: mine, _count: true }),
    db.ticket.count({ where: mine }),
    db.ticket.findMany({
      where: mine,
      select: {
        number: true,
        title: true,
        status: true,
        openedAt: true,
        category: { select: { name: true, icon: true } },
      },
      orderBy: { openedAt: "desc" },
      take: 5,
    }),
  ]);

  const count = (status: TicketStatus) =>
    groups.find((g) => g.status === status)?._count ?? 0;

  return {
    total,
    abertos: count(TicketStatus.ABERTO),
    emAndamento: count(TicketStatus.EM_ANDAMENTO),
    aguardandoResposta: count(TicketStatus.AGUARDANDO_USUARIO),
    finalizados: count(TicketStatus.FINALIZADO),
    recent: recentTickets.map((t) => ({
      number: t.number,
      title: t.title,
      status: t.status,
      openedAt: t.openedAt,
      categoryName: t.category.name,
      categoryIcon: t.category.icon,
    })),
  };
}

export { OPEN_STATUSES };
