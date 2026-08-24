import "server-only";
import { TicketStatus, type Priority } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { AppError, forbidden, notFound } from "@/lib/http/errors";
import { can, assertCan } from "@/lib/auth/guards";
import type { SessionUser } from "@/lib/auth/session";
import { createEventCollector } from "@/lib/events/bus";
import { isTerminal } from "@/config/status";
import { PERMISSIONS, ROLES } from "@/config/permissions";
import { assertTransitionAllowed } from "./state-machine";
import { applyStatusChange } from "./ticket-effects";
import type { CreateTicketInput, UpdateTicketInput } from "./schemas";
import type { StoredFile } from "@/lib/storage";

/**
 * Service de chamados.
 *
 * Cada funcao publica segue o mesmo formato: valida permissao, busca o
 * chamado, valida a regra de negocio especifica, aplica a mudanca dentro de
 * uma transacao (emitindo os eventos de dominio) e so entao dispara os
 * efeitos colaterais (flush). Nenhuma rota de API deve tocar o Prisma
 * diretamente para mutar um chamado - tudo passa por aqui.
 */

function isTechnicianRole(slug: string): boolean {
  return slug === ROLES.TECNICO || slug === ROLES.ADMIN;
}

// --- Criacao -----------------------------------------------------------

export async function createTicket(
  user: SessionUser,
  input: CreateTicketInput,
): Promise<{ id: string; number: number }> {
  assertCan(user, PERMISSIONS.TICKET_CREATE);

  const category = await db.category.findUnique({ where: { id: input.categoryId } });
  if (!category || !category.isActive) {
    throw new AppError("VALIDATION_ERROR", "Selecione uma categoria valida.");
  }

  const requester = await db.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { departmentId: true },
  });

  const collector = createEventCollector();

  const ticket = await db.$transaction(async (tx) => {
    const created = await tx.ticket.create({
      data: {
        title: input.title,
        description: input.description,
        categoryId: category.id,
        // O colaborador nao escolhe prioridade: se pudesse, em duas semanas
        // todo chamado seria URGENTE e o campo perderia valor de triagem.
        priority: category.defaultPriority,
        requesterId: user.id,
        // Snapshot do setor no momento da abertura - se o colaborador mudar
        // de setor depois, os relatorios historicos nao mudam retroativamente.
        departmentId: requester.departmentId,
      },
    });

    await collector.emit(
      {
        type: "ticket.created",
        ticketId: created.id,
        actorId: user.id,
        categoryName: category.name,
        priority: created.priority,
      },
      tx,
    );

    return created;
  });

  await collector.flush(db);
  return { id: ticket.id, number: ticket.number };
}

// --- Atribuicao ("assumir") ---------------------------------------------

/**
 * Atribui o chamado a um tecnico. `assigneeId` ausente ou igual ao proprio
 * usuario = "assumir" (autoatribuicao); qualquer outro valor = atribuir a
 * outro tecnico, o que exige a permissao administrativa.
 *
 * Se o chamado ainda estiver ABERTO, atribuir e iniciar o atendimento sao a
 * MESMA acao: o chamado nunca fica EM_ANDAMENTO sem responsavel.
 */
export async function assignTicket(
  user: SessionUser,
  ticketNumber: number,
  assigneeId?: string | null,
): Promise<void> {
  const targetId = assigneeId ?? user.id;
  const isSelfAssign = targetId === user.id;

  assertCan(user, isSelfAssign ? PERMISSIONS.TICKET_ASSIGN : PERMISSIONS.TICKET_ASSIGN_OTHERS);

  const ticket = await db.ticket.findUnique({
    where: { number: ticketNumber },
    select: {
      id: true,
      status: true,
      assignee: { select: { name: true } },
    },
  });
  if (!ticket) throw notFound("Chamado");

  const assignableStatuses: TicketStatus[] = [
    TicketStatus.ABERTO,
    TicketStatus.EM_ANDAMENTO,
    TicketStatus.AGUARDANDO_USUARIO,
  ];
  if (!assignableStatuses.includes(ticket.status)) {
    throw new AppError("TICKET_TERMINAL", "Este chamado ja foi encerrado.");
  }

  const assignee = await db.user.findUnique({
    where: { id: targetId },
    select: { id: true, name: true, isActive: true, role: { select: { slug: true } } },
  });
  if (!assignee || !assignee.isActive || !isTechnicianRole(assignee.role.slug)) {
    throw new AppError("ASSIGNEE_REQUIRED", "Selecione um tecnico ativo da TI.");
  }

  const collector = createEventCollector();

  await db.$transaction(async (tx) => {
    const startsAttendance = ticket.status === TicketStatus.ABERTO;
    const nextStatus = startsAttendance ? TicketStatus.EM_ANDAMENTO : ticket.status;

    await tx.ticket.update({
      where: { id: ticket.id },
      data: { assigneeId: assignee.id, status: nextStatus },
    });

    await collector.emit(
      {
        type: "ticket.assigned",
        ticketId: ticket.id,
        actorId: user.id,
        assigneeId: assignee.id,
        assigneeName: assignee.name,
        previousAssigneeName: ticket.assignee?.name ?? null,
      },
      tx,
    );

    if (startsAttendance) {
      await collector.emit(
        {
          type: "ticket.status_changed",
          ticketId: ticket.id,
          actorId: user.id,
          from: TicketStatus.ABERTO,
          to: TicketStatus.EM_ANDAMENTO,
        },
        tx,
      );
    }
  });

  await collector.flush(db);
}

// --- Transicao de status --------------------------------------------------

export type TransitionOptions = { closingNote?: string; note?: string };

export async function transitionStatus(
  user: SessionUser,
  ticketNumber: number,
  to: TicketStatus,
  options: TransitionOptions = {},
): Promise<void> {
  const ticket = await db.ticket.findUnique({
    where: { number: ticketNumber },
    select: {
      id: true,
      status: true,
      requesterId: true,
      assigneeId: true,
      closedAt: true,
      waitingSince: true,
      waitingSeconds: true,
    },
  });
  if (!ticket) throw notFound("Chamado");

  if (ticket.status === TicketStatus.ABERTO && to === TicketStatus.EM_ANDAMENTO) {
    throw new AppError(
      "INVALID_TRANSITION",
      "Para iniciar o atendimento, assuma o chamado em vez de apenas mudar o status.",
    );
  }

  assertTransitionAllowed({
    ticket: {
      status: ticket.status,
      requesterId: ticket.requesterId,
      assigneeId: ticket.assigneeId,
      closedAt: ticket.closedAt,
    },
    user,
    to,
    closingNote: options.closingNote,
    note: options.note,
  });

  const collector = createEventCollector();

  await db.$transaction(async (tx) => {
    await applyStatusChange(tx, collector, ticket, to, user.id, options);
  });

  await collector.flush(db);
}

// --- Edicao de titulo/descricao -------------------------------------------

/**
 * O solicitante so edita o proprio chamado enquanto ele estiver ABERTO e
 * ninguem tiver assumido - depois disso, qualquer correcao deve ir por
 * comentario, para nao apagar o que a TI ja esta usando para atender. O admin
 * tem uma valvula de escape para corrigir erros de digitacao a qualquer momento.
 */
export async function updateTicket(
  user: SessionUser,
  ticketNumber: number,
  input: UpdateTicketInput,
): Promise<void> {
  const ticket = await db.ticket.findUnique({
    where: { number: ticketNumber },
    select: {
      id: true,
      status: true,
      requesterId: true,
      assigneeId: true,
      title: true,
      description: true,
    },
  });
  if (!ticket) throw notFound("Chamado");

  const isOwnerEditingDraft =
    ticket.requesterId === user.id &&
    ticket.status === TicketStatus.ABERTO &&
    ticket.assigneeId === null &&
    can(user, PERMISSIONS.TICKET_EDIT_OWN_DRAFT);
  const isAdminOverride = can(user, PERMISSIONS.TICKET_ASSIGN_OTHERS);

  if (!isOwnerEditingDraft && !isAdminOverride) {
    throw forbidden("So e possivel editar o chamado enquanto ninguem assumiu.");
  }

  const collector = createEventCollector();

  await db.$transaction(async (tx) => {
    await tx.ticket.update({
      where: { id: ticket.id },
      data: {
        title: input.title,
        description: input.description,
      },
    });

    if (input.title && input.title !== ticket.title) {
      await collector.emit(
        {
          type: "ticket.edited",
          ticketId: ticket.id,
          actorId: user.id,
          field: "title",
          oldValue: ticket.title,
          newValue: input.title,
        },
        tx,
      );
    }
    if (input.description && input.description !== ticket.description) {
      await collector.emit(
        {
          type: "ticket.edited",
          ticketId: ticket.id,
          actorId: user.id,
          field: "description",
          oldValue: ticket.description,
          newValue: input.description,
        },
        tx,
      );
    }
  });

  await collector.flush(db);
}

// --- Categoria e prioridade (privativas da TI) -----------------------------

export async function changeCategory(
  user: SessionUser,
  ticketNumber: number,
  categoryId: string,
): Promise<void> {
  assertCan(user, PERMISSIONS.TICKET_CHANGE_CATEGORY);

  const ticket = await db.ticket.findUnique({
    where: { number: ticketNumber },
    select: { id: true, status: true, categoryId: true, category: { select: { name: true } } },
  });
  if (!ticket) throw notFound("Chamado");
  if (isTerminal(ticket.status)) {
    throw new AppError("TICKET_TERMINAL", "Um chamado encerrado nao pode ser alterado.");
  }

  const category = await db.category.findUnique({ where: { id: categoryId } });
  if (!category || !category.isActive) {
    throw new AppError("VALIDATION_ERROR", "Selecione uma categoria valida.");
  }
  if (category.id === ticket.categoryId) return;

  const collector = createEventCollector();
  await db.$transaction(async (tx) => {
    await tx.ticket.update({ where: { id: ticket.id }, data: { categoryId: category.id } });
    await collector.emit(
      {
        type: "ticket.category_changed",
        ticketId: ticket.id,
        actorId: user.id,
        fromName: ticket.category.name,
        toName: category.name,
      },
      tx,
    );
  });
  await collector.flush(db);
}

export async function changePriority(
  user: SessionUser,
  ticketNumber: number,
  priority: Priority,
): Promise<void> {
  assertCan(user, PERMISSIONS.TICKET_CHANGE_PRIORITY);

  const ticket = await db.ticket.findUnique({
    where: { number: ticketNumber },
    select: { id: true, status: true, priority: true },
  });
  if (!ticket) throw notFound("Chamado");
  if (isTerminal(ticket.status)) {
    throw new AppError("TICKET_TERMINAL", "Um chamado encerrado nao pode ser alterado.");
  }
  if (priority === ticket.priority) return;

  const collector = createEventCollector();
  await db.$transaction(async (tx) => {
    await tx.ticket.update({ where: { id: ticket.id }, data: { priority } });
    await collector.emit(
      {
        type: "ticket.priority_changed",
        ticketId: ticket.id,
        actorId: user.id,
        from: ticket.priority,
        to: priority,
      },
      tx,
    );
  });
  await collector.flush(db);
}

// --- Anexos ------------------------------------------------------------

/**
 * Registra um arquivo ja validado e gravado em disco (ver src/lib/storage)
 * como anexo do chamado. A validacao de tipo/tamanho acontece em
 * saveAttachment - aqui so persistimos o resultado e emitimos o evento.
 */
export async function addAttachmentToTicket(
  user: SessionUser,
  ticketId: string,
  file: StoredFile,
): Promise<void> {
  assertCan(user, PERMISSIONS.ATTACHMENT_UPLOAD);

  const collector = createEventCollector();

  await db.$transaction(async (tx) => {
    const attachment = await tx.attachment.create({
      data: {
        ticketId,
        uploaderId: user.id,
        originalName: file.originalName,
        storedName: file.storedName,
        mimeType: file.mimeType,
        sizeBytes: file.sizeBytes,
        checksumSha256: file.checksumSha256,
      },
    });

    await collector.emit(
      {
        type: "attachment.added",
        ticketId,
        actorId: user.id,
        attachmentId: attachment.id,
        fileName: file.originalName,
      },
      tx,
    );
  });

  await collector.flush(db);
}

export { autoFinalizeResolvedTickets } from "./ticket-effects";
