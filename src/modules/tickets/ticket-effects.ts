import "server-only";
import { TicketStatus } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { addBusinessDays } from "@/lib/datetime";
import { createEventCollector, type EventCollector } from "@/lib/events/bus";

/**
 * Nucleo puro da mudanca de status de um chamado: bookkeeping do tempo de
 * espera, campos de fechamento/reabertura e emissao do evento de dominio.
 *
 * Deliberadamente NAO valida quem pode fazer a transicao - isso e
 * responsabilidade de quem chama:
 *   - transitionStatus() (service.ts) valida via state-machine.ts para acao manual;
 *   - autoFinalizeResolvedTickets() e a futura auto-reabertura ao comentar
 *     (modulo de Interacoes) chamam esta funcao diretamente, porque ELAS SAO
 *     o sistema agindo.
 *
 * Centralizar aqui e o que garante que o desconto de waitingSeconds e o
 * reopenedCount fiquem corretos em QUALQUER caminho que muda o status, manual
 * ou automatico, sem duplicar a logica.
 */
export async function applyStatusChange(
  tx: Prisma.TransactionClient,
  collector: EventCollector,
  ticket: {
    id: string;
    status: TicketStatus;
    waitingSince: Date | null;
    waitingSeconds: number;
  },
  to: TicketStatus,
  actorId: string | null,
  options: { closingNote?: string; note?: string } = {},
): Promise<void> {
  const isReopen =
    (ticket.status === TicketStatus.RESOLVIDO || ticket.status === TicketStatus.FINALIZADO) &&
    to === TicketStatus.EM_ANDAMENTO;

  const now = new Date();
  // "Unchecked": permite gravar closedById como chave estrangeira crua, em vez
  // de exigir a forma de relacao { closedBy: { connect: {...} } }.
  const data: Prisma.TicketUncheckedUpdateInput = { status: to };

  // Fecha a janela de espera sempre que sai de AGUARDANDO_USUARIO, somando o
  // tempo decorrido ao acumulador - e o que garante que o tempo de resposta do
  // usuario nunca seja contado como demora da TI.
  if (ticket.status === TicketStatus.AGUARDANDO_USUARIO && ticket.waitingSince) {
    const elapsedSeconds = Math.floor(
      (now.getTime() - ticket.waitingSince.getTime()) / 1000,
    );
    data.waitingSeconds = ticket.waitingSeconds + elapsedSeconds;
    data.waitingSince = null;
  }
  // Abre a janela de espera ao entrar em AGUARDANDO_USUARIO.
  if (to === TicketStatus.AGUARDANDO_USUARIO) {
    data.waitingSince = now;
  }

  if (to === TicketStatus.RESOLVIDO) {
    data.resolvedAt = now;
    data.closingNote = options.closingNote;
  }
  if (to === TicketStatus.FINALIZADO) {
    data.closedAt = now;
    data.closedById = actorId;
  }
  if (to === TicketStatus.CANCELADO) {
    data.closedAt = now;
    data.closedById = actorId;
    data.closingNote = options.closingNote;
  }
  if (to === TicketStatus.EM_ANDAMENTO) {
    // Reabertura ou retorno manual de AGUARDANDO_USUARIO: o chamado volta a
    // estar ativo, entao o fechamento anterior deixa de valer.
    data.resolvedAt = null;
    data.closedAt = null;
    data.closedById = null;
    if (isReopen) data.reopenedCount = { increment: 1 };
  }

  await tx.ticket.update({ where: { id: ticket.id }, data });

  if (isReopen) {
    await collector.emit(
      { type: "ticket.reopened", ticketId: ticket.id, actorId, from: ticket.status },
      tx,
    );
  } else {
    await collector.emit(
      {
        type: "ticket.status_changed",
        ticketId: ticket.id,
        actorId,
        from: ticket.status,
        to,
        note: options.closingNote ?? options.note,
      },
      tx,
    );
  }

  // A TI so pode pausar o chamado explicando o motivo ao solicitante - por
  // isso a transicao para AGUARDANDO_USUARIO grava um comentario PUBLICO de
  // verdade (nao so uma linha no historico), que o colaborador ve na tela dele.
  if (to === TicketStatus.AGUARDANDO_USUARIO && options.note && actorId) {
    const comment = await tx.ticketComment.create({
      data: {
        ticketId: ticket.id,
        authorId: actorId,
        body: options.note,
        isInternal: false,
      },
    });
    await collector.emit(
      {
        type: "comment.created",
        ticketId: ticket.id,
        actorId,
        commentId: comment.id,
        isInternal: false,
      },
      tx,
    );
  }
}

/**
 * Confirma automaticamente os chamados RESOLVIDO ha mais de 3 dias uteis sem
 * resposta do solicitante. Pensado para rodar em um job agendado (Fase 3);
 * por ora e invocavel manualmente.
 */
export async function autoFinalizeResolvedTickets(
  businessDaysThreshold = 3,
): Promise<number> {
  const candidates = await db.ticket.findMany({
    where: { status: TicketStatus.RESOLVIDO },
    select: {
      id: true,
      status: true,
      resolvedAt: true,
      waitingSince: true,
      waitingSeconds: true,
    },
  });

  const now = Date.now();
  const due = candidates.filter(
    (t) =>
      t.resolvedAt &&
      addBusinessDays(t.resolvedAt, businessDaysThreshold).getTime() <= now,
  );
  if (due.length === 0) return 0;

  const collector = createEventCollector();

  await db.$transaction(async (tx) => {
    for (const ticket of due) {
      await applyStatusChange(tx, collector, ticket, TicketStatus.FINALIZADO, null, {
        note: `Confirmado automaticamente apos ${businessDaysThreshold} dias uteis sem resposta.`,
      });
    }
  });

  await collector.flush(db);
  return due.length;
}
