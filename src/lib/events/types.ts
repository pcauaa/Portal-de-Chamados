import type { Prisma } from "@/generated/prisma/client";
import type { TicketStatus, Priority } from "@/generated/prisma/enums";

/**
 * Eventos de dominio.
 *
 * Toda mudanca relevante em um chamado emite um evento. Essa e a decisao de
 * arquitetura que sustenta o crescimento do sistema:
 *
 *   Fase 1  - um unico handler, que grava em ticket_history.
 *   Fase 3  - + notificacao in-app.
 *   Fase 4  - + e-mail.
 *   Fase 6  - + Microsoft Teams, + WhatsApp.
 *
 * Cada integracao futura e um ARQUIVO NOVO registrado no bus, sem alterar uma
 * linha dos services. E isso que transforma "notificar por Teams" de uma
 * refatoracao de dias em uma tarefa de horas.
 */

export type TicketEventBase = {
  ticketId: string;
  /** Quem executou. null = acao automatica do sistema. */
  actorId: string | null;
};

export type DomainEvent =
  | (TicketEventBase & {
      type: "ticket.created";
      categoryName: string;
      priority: Priority;
    })
  | (TicketEventBase & {
      type: "ticket.assigned";
      assigneeId: string | null;
      assigneeName: string | null;
      previousAssigneeName: string | null;
    })
  | (TicketEventBase & {
      type: "ticket.status_changed";
      from: TicketStatus;
      to: TicketStatus;
      note?: string;
    })
  | (TicketEventBase & {
      type: "ticket.priority_changed";
      from: Priority;
      to: Priority;
    })
  | (TicketEventBase & {
      type: "ticket.category_changed";
      fromName: string;
      toName: string;
    })
  | (TicketEventBase & {
      type: "ticket.edited";
      field: "title" | "description";
      oldValue: string;
      newValue: string;
    })
  | (TicketEventBase & {
      type: "ticket.reopened";
      from: TicketStatus;
    })
  | (TicketEventBase & {
      type: "comment.created";
      commentId: string;
      isInternal: boolean;
    })
  | (TicketEventBase & {
      type: "attachment.added";
      attachmentId: string;
      fileName: string;
    })
  | (TicketEventBase & {
      type: "ticket.rated";
      score: number;
    });

export type DomainEventType = DomainEvent["type"];

/**
 * Handlers recebem o cliente da transacao em curso.
 *
 * Consequencia importante: o handler de historico grava na MESMA transacao que
 * alterou o chamado. Ou os dois acontecem, ou nenhum dos dois - nunca existe
 * chamado alterado sem registro no historico.
 */
export type EventHandler = (
  event: DomainEvent,
  tx: Prisma.TransactionClient,
) => Promise<void>;
