"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth/guards";
import { isAppError } from "@/lib/http/errors";
import { logger } from "@/lib/logger";
import { TicketStatus, Priority } from "@/generated/prisma/enums";
import { createComment } from "@/modules/interactions/comments.service";
import { createCommentSchema } from "@/modules/interactions/schemas";
import {
  assignTicket,
  transitionStatus,
  changePriority,
  changeCategory,
} from "@/modules/tickets/service";

export type ActionState = { error: string | null; ok?: boolean };

/** Envolve a acao: sessao, tratamento de erro e revalidacao da pagina. */
async function run(
  ticketNumber: number,
  fn: (user: Awaited<ReturnType<typeof requireSession>>) => Promise<void>,
): Promise<ActionState> {
  try {
    const user = await requireSession();
    await fn(user);
  } catch (error) {
    if (isAppError(error)) return { error: error.message };
    logger.error({ err: error, ticketNumber }, "falha em acao do chamado");
    return { error: "Nao foi possivel concluir a acao." };
  }

  // Server Component: sem isso a timeline continuaria mostrando o estado antigo.
  revalidatePath(`/chamados/${ticketNumber}`);
  return { error: null, ok: true };
}

export async function commentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const ticketNumber = Number(formData.get("ticketNumber"));

  const parsed = createCommentSchema.safeParse({
    body: formData.get("body"),
    isInternal: formData.get("isInternal") === "on",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados invalidos." };
  }

  return run(ticketNumber, async (user) => {
    await createComment(user, ticketNumber, parsed.data);
  });
}

export async function assignAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const ticketNumber = Number(formData.get("ticketNumber"));
  const assigneeId = (formData.get("assigneeId") as string) || undefined;
  return run(ticketNumber, (user) => assignTicket(user, ticketNumber, assigneeId));
}

export async function transitionAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const ticketNumber = Number(formData.get("ticketNumber"));
  const to = formData.get("to") as TicketStatus;
  const text = ((formData.get("text") as string) ?? "").trim() || undefined;

  if (!Object.values(TicketStatus).includes(to)) {
    return { error: "Status invalido." };
  }

  // O mesmo campo de texto serve a dois propositos conforme o destino: nota de
  // fechamento (RESOLVIDO/CANCELADO) ou explicacao ao usuario (AGUARDANDO).
  const needsClosingNote = to === TicketStatus.RESOLVIDO || to === TicketStatus.CANCELADO;
  const options = needsClosingNote ? { closingNote: text } : { note: text };

  return run(ticketNumber, (user) => transitionStatus(user, ticketNumber, to, options));
}

export async function changePriorityAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const ticketNumber = Number(formData.get("ticketNumber"));
  const priority = formData.get("priority") as Priority;

  if (!Object.values(Priority).includes(priority)) {
    return { error: "Prioridade invalida." };
  }
  return run(ticketNumber, (user) => changePriority(user, ticketNumber, priority));
}

export async function changeCategoryAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const ticketNumber = Number(formData.get("ticketNumber"));
  const categoryId = formData.get("categoryId") as string;
  return run(ticketNumber, (user) => changeCategory(user, ticketNumber, categoryId));
}
