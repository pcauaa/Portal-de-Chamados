import "server-only";
import { TicketStatus } from "@/generated/prisma/enums";
import { PERMISSIONS, type Permission } from "@/config/permissions";
import { STATUS_META } from "@/config/status";
import { can } from "@/lib/auth/guards";
import { AppError } from "@/lib/http/errors";
import type { SessionUser } from "@/lib/auth/session";

/**
 * Maquina de estados dos chamados.
 *
 * Esta tabela e a UNICA fonte da verdade sobre quem pode mudar um chamado de
 * um status para outro. A API e o service nunca verificam
 * `if (status === "ABERTO")` por conta propria - eles sempre perguntam a este
 * modulo. E isso que torna a regra de negocio auditavel em um unico lugar em
 * vez de espalhada por handlers de rota.
 *
 * Uma transicao esta deliberadamente FORA desta tabela: ABERTO -> EM_ANDAMENTO.
 * Ela so acontece atraves de assignTicket() (o "assumir"), porque a regra de
 * negocio e que um chamado nunca entra em andamento sem responsavel - as duas
 * coisas sao uma acao so, nao duas transicoes independentes.
 */

export type TicketSnapshot = {
  status: TicketStatus;
  requesterId: string;
  assigneeId: string | null;
  closedAt: Date | null;
};

type Actor =
  /** O proprio solicitante do chamado. */
  | "requester"
  /** O tecnico responsavel pelo chamado, OU qualquer usuario com TICKET_ASSIGN_OTHERS (admin). */
  | "assigneeOrAdmin"
  /** Qualquer usuario com TICKET_CHANGE_STATUS (tecnico ou admin), independente de ser o responsavel. */
  | "technician";

type Rule = {
  to: TicketStatus;
  actors: Actor[];
  /**
   * Quando "requester" esta entre os actors, esta e a permissao adicional que
   * ele precisa ter. undefined = basta ser o solicitante (ex.: confirmar a
   * propria resolucao nao exige uma permissao especial).
   */
  requesterPermission?: Permission;
  /** Exige texto de fechamento (solucao aplicada ou motivo do cancelamento). */
  requiresClosingNote?: boolean;
  /** Exige um comentario explicando por que o chamado esta sendo pausado. */
  requiresNote?: boolean;
  /** Prazo, em dias corridos a partir do fechamento, para a transicao ainda ser permitida. */
  withinDaysOfClose?: number;
};

const RULES: Partial<Record<TicketStatus, Rule[]>> = {
  [TicketStatus.ABERTO]: [
    {
      to: TicketStatus.AGUARDANDO_USUARIO,
      actors: ["assigneeOrAdmin"],
      requiresNote: true,
    },
    {
      to: TicketStatus.CANCELADO,
      actors: ["requester", "technician"],
      requesterPermission: PERMISSIONS.TICKET_CANCEL_OWN,
      requiresClosingNote: true,
    },
  ],
  [TicketStatus.EM_ANDAMENTO]: [
    {
      to: TicketStatus.AGUARDANDO_USUARIO,
      actors: ["assigneeOrAdmin"],
      requiresNote: true,
    },
    {
      to: TicketStatus.RESOLVIDO,
      actors: ["assigneeOrAdmin"],
      requiresClosingNote: true,
    },
    {
      // Diferente do ABERTO->CANCELADO: aqui o solicitante NAO pode cancelar
      // sozinho - o chamado ja esta sendo trabalhado pela TI.
      to: TicketStatus.CANCELADO,
      actors: ["technician"],
      requiresClosingNote: true,
    },
  ],
  [TicketStatus.AGUARDANDO_USUARIO]: [
    { to: TicketStatus.EM_ANDAMENTO, actors: ["technician"] },
    { to: TicketStatus.CANCELADO, actors: ["technician"], requiresClosingNote: true },
  ],
  [TicketStatus.RESOLVIDO]: [
    { to: TicketStatus.FINALIZADO, actors: ["requester", "technician"] },
    {
      to: TicketStatus.EM_ANDAMENTO,
      actors: ["requester", "technician"],
      requesterPermission: PERMISSIONS.TICKET_REOPEN,
    },
  ],
  [TicketStatus.FINALIZADO]: [
    {
      to: TicketStatus.EM_ANDAMENTO,
      actors: ["technician"],
      // Depois de 7 dias o chamado esta genuinamente encerrado: a correcao
      // vira um chamado novo, para nao acumular historico infinito no antigo.
      withinDaysOfClose: 7,
    },
  ],
  [TicketStatus.CANCELADO]: [], // terminal - nenhuma transicao sai daqui
};

export type TransitionCheckInput = {
  ticket: TicketSnapshot;
  user: SessionUser;
  to: TicketStatus;
  closingNote?: string;
  note?: string;
};

/** Verifica topologicamente se a transicao existe, sem checar quem a aciona. */
export function isValidTransition(from: TicketStatus, to: TicketStatus): boolean {
  return (RULES[from] ?? []).some((rule) => rule.to === to);
}

/**
 * Valida uma transicao acionada por um usuario real.
 * Lanca AppError quando a transicao nao existe, o usuario nao pode acion-la,
 * ou falta uma informacao obrigatoria (nota de fechamento/motivo).
 *
 * Transicoes automaticas (fechamento apos 3 dias uteis, retorno ao comentar)
 * NAO passam por aqui: elas sao o proprio sistema agindo, entao aplicam a
 * mudanca diretamente em ticket-effects.ts.
 */
export function assertTransitionAllowed(input: TransitionCheckInput): void {
  const { ticket, user, to } = input;
  const rule = (RULES[ticket.status] ?? []).find((r) => r.to === to);

  if (!rule) {
    throw new AppError(
      "INVALID_TRANSITION",
      `Nao e possivel mudar de "${STATUS_META[ticket.status].label}" para "${STATUS_META[to].label}".`,
    );
  }

  const authorized = rule.actors.some((actor) => actorMatches(actor, rule, ticket, user));
  if (!authorized) {
    throw new AppError("FORBIDDEN", "Voce nao pode executar esta acao neste chamado.");
  }

  if (rule.requiresClosingNote && !input.closingNote?.trim()) {
    throw new AppError(
      "CLOSING_NOTE_REQUIRED",
      "Descreva a solucao aplicada (ou o motivo, em caso de cancelamento).",
    );
  }

  if (rule.requiresNote && !input.note?.trim()) {
    throw new AppError(
      "COMMENT_REQUIRED",
      "Explique ao solicitante por que o chamado esta sendo pausado.",
    );
  }

  if (rule.withinDaysOfClose && ticket.closedAt) {
    const deadline = ticket.closedAt.getTime() + rule.withinDaysOfClose * 24 * 3600 * 1000;
    if (Date.now() > deadline) {
      throw new AppError(
        "TICKET_TERMINAL",
        `Este chamado foi encerrado ha mais de ${rule.withinDaysOfClose} dias. Abra um novo chamado.`,
      );
    }
  }
}

function actorMatches(
  actor: Actor,
  rule: Rule,
  ticket: TicketSnapshot,
  user: SessionUser,
): boolean {
  switch (actor) {
    case "requester":
      if (ticket.requesterId !== user.id) return false;
      return !rule.requesterPermission || can(user, rule.requesterPermission);

    case "assigneeOrAdmin":
      return (
        (ticket.assigneeId === user.id && can(user, PERMISSIONS.TICKET_CHANGE_STATUS)) ||
        can(user, PERMISSIONS.TICKET_ASSIGN_OTHERS)
      );

    case "technician":
      return can(user, PERMISSIONS.TICKET_CHANGE_STATUS);
  }
}
