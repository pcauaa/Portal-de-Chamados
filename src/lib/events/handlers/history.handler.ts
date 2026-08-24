import { STATUS_META, PRIORITY_META } from "@/config/status";
import type { EventHandler } from "../types";

/**
 * Traduz o evento de dominio em uma linha de ticket_history.
 *
 * Este handler e o motivo pelo qual nenhum service precisa lembrar de gravar
 * historico: ele e chamado pelo bus a cada evento, dentro da mesma transacao.
 * Esquecer de registrar uma alteracao deixou de ser possivel.
 */
export const historyHandler: EventHandler = async (event, tx) => {
  const base = {
    ticketId: event.ticketId,
    actorId: event.actorId,
    eventType: event.type,
  };

  switch (event.type) {
    case "ticket.created":
      await tx.ticketHistory.create({
        data: {
          ...base,
          metadata: {
            categoria: event.categoryName,
            prioridade: PRIORITY_META[event.priority].label,
          },
        },
      });
      return;

    case "ticket.assigned":
      await tx.ticketHistory.create({
        data: {
          ...base,
          field: "assignee",
          oldValue: event.previousAssigneeName,
          newValue: event.assigneeName,
        },
      });
      return;

    case "ticket.status_changed":
      await tx.ticketHistory.create({
        data: {
          ...base,
          field: "status",
          oldValue: STATUS_META[event.from].label,
          newValue: STATUS_META[event.to].label,
          metadata: event.note ? { observacao: event.note } : undefined,
        },
      });
      return;

    case "ticket.priority_changed":
      await tx.ticketHistory.create({
        data: {
          ...base,
          field: "priority",
          oldValue: PRIORITY_META[event.from].label,
          newValue: PRIORITY_META[event.to].label,
        },
      });
      return;

    case "ticket.category_changed":
      await tx.ticketHistory.create({
        data: {
          ...base,
          field: "category",
          oldValue: event.fromName,
          newValue: event.toName,
        },
      });
      return;

    case "ticket.edited":
      // O texto completo vai para metadata, nao para old_value/new_value:
      // essas colunas sao VarChar(160) e uma descricao longa seria truncada,
      // destruindo justamente o registro que da valor ao historico.
      await tx.ticketHistory.create({
        data: {
          ...base,
          field: event.field,
          oldValue: truncate(event.oldValue),
          newValue: truncate(event.newValue),
          metadata: {
            valorAnteriorCompleto: event.oldValue,
            valorNovoCompleto: event.newValue,
          },
        },
      });
      return;

    case "ticket.reopened":
      await tx.ticketHistory.create({
        data: {
          ...base,
          field: "status",
          oldValue: STATUS_META[event.from].label,
          newValue: "Reaberto",
        },
      });
      return;

    case "comment.created":
      await tx.ticketHistory.create({
        data: {
          ...base,
          metadata: {
            comentarioId: event.commentId,
            interno: event.isInternal,
          },
        },
      });
      return;

    case "attachment.added":
      await tx.ticketHistory.create({
        data: {
          ...base,
          newValue: truncate(event.fileName),
          metadata: { anexoId: event.attachmentId },
        },
      });
      return;

    case "ticket.rated":
      await tx.ticketHistory.create({
        data: { ...base, newValue: `${event.score} de 5` },
      });
      return;
  }
};

function truncate(value: string): string {
  return value.length > 160 ? `${value.slice(0, 157)}...` : value;
}
