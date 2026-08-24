import "server-only";
import { TicketStatus } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { AppError, notFound } from "@/lib/http/errors";
import { assertCan, can } from "@/lib/auth/guards";
import type { SessionUser } from "@/lib/auth/session";
import { createEventCollector } from "@/lib/events/bus";
import { PERMISSIONS } from "@/config/permissions";
import { isTerminal } from "@/config/status";
import { applyStatusChange } from "@/modules/tickets/ticket-effects";
import type { CreateCommentInput } from "./schemas";

/**
 * Comentarios do chamado.
 *
 * Duas regras de negocio nao obvias vivem aqui:
 *
 * 1. Comentario do solicitante em chamado AGUARDANDO_USUARIO devolve o chamado
 *    para EM_ANDAMENTO automaticamente. Sem isso, o colaborador responderia e o
 *    chamado continuaria parado esperando alguem da TI notar - que e
 *    exatamente a falha do WhatsApp que este sistema veio resolver.
 *
 * 2. O primeiro comentario PUBLICO da TI grava first_response_at, que alimenta
 *    a metrica de tempo de primeira resposta. Nota interna nao conta: o
 *    usuario nao a ve, entao ela nao e resposta nenhuma para ele.
 */
export async function createComment(
  user: SessionUser,
  ticketNumber: number,
  input: CreateCommentInput,
): Promise<{ id: string }> {
  assertCan(user, PERMISSIONS.COMMENT_CREATE);

  if (input.isInternal) {
    assertCan(user, PERMISSIONS.COMMENT_INTERNAL);
  }

  const ticket = await db.ticket.findUnique({
    where: { number: ticketNumber },
    select: {
      id: true,
      status: true,
      requesterId: true,
      firstResponseAt: true,
      waitingSince: true,
      waitingSeconds: true,
    },
  });
  if (!ticket) throw notFound("Chamado");

  // Escopo de leitura: quem nao ve o chamado tambem nao comenta nele.
  const canViewAll = can(user, PERMISSIONS.TICKET_VIEW_ALL);
  if (!canViewAll && ticket.requesterId !== user.id) {
    throw notFound("Chamado");
  }

  if (isTerminal(ticket.status)) {
    throw new AppError(
      "TICKET_TERMINAL",
      "Este chamado esta encerrado. Reabra-o para continuar a conversa.",
    );
  }

  const isRequester = ticket.requesterId === user.id;
  const collector = createEventCollector();

  const comment = await db.$transaction(async (tx) => {
    const created = await tx.ticketComment.create({
      data: {
        ticketId: ticket.id,
        authorId: user.id,
        body: input.body,
        isInternal: input.isInternal,
      },
    });

    await collector.emit(
      {
        type: "comment.created",
        ticketId: ticket.id,
        actorId: user.id,
        commentId: created.id,
        isInternal: input.isInternal,
      },
      tx,
    );

    // Regra 2: marca a primeira resposta publica da TI.
    if (!isRequester && !input.isInternal && ticket.firstResponseAt === null) {
      await tx.ticket.update({
        where: { id: ticket.id },
        data: { firstResponseAt: new Date() },
      });
    }

    // Regra 1: o solicitante respondeu, o chamado volta a andar.
    if (isRequester && ticket.status === TicketStatus.AGUARDANDO_USUARIO) {
      await applyStatusChange(
        tx,
        collector,
        ticket,
        TicketStatus.EM_ANDAMENTO,
        // actorId null: quem mudou o status foi o sistema reagindo a resposta,
        // nao o usuario clicando em "mudar status".
        null,
        { note: "Solicitante respondeu." },
      );
    }

    return created;
  });

  await collector.flush(db);
  return { id: comment.id };
}

/**
 * Comentarios visiveis para este usuario.
 *
 * O filtro de nota interna e aplicado NA CONSULTA, nao na renderizacao: um
 * comentario interno jamais chega ao navegador do colaborador para depois ser
 * escondido com CSS - bastaria abrir o inspetor para le-lo.
 */
export async function listComments(user: SessionUser, ticketId: string) {
  const canSeeInternal = can(user, PERMISSIONS.COMMENT_INTERNAL);

  return db.ticketComment.findMany({
    where: {
      ticketId,
      deletedAt: null,
      ...(canSeeInternal ? {} : { isInternal: false }),
    },
    select: {
      id: true,
      body: true,
      isInternal: true,
      createdAt: true,
      editedAt: true,
      author: { select: { id: true, name: true } },
      attachments: {
        select: { id: true, originalName: true, mimeType: true, sizeBytes: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });
}

export type TicketComment = Awaited<ReturnType<typeof listComments>>[number];
