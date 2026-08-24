"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth/guards";
import { isAppError } from "@/lib/http/errors";
import { logger } from "@/lib/logger";
import { assignTicket } from "@/modules/tickets/service";

export type QueueActionState = { error: string | null };

/** "Assumir" direto da fila - a acao mais usada da tela. */
export async function quickAssignAction(
  _prev: QueueActionState,
  formData: FormData,
): Promise<QueueActionState> {
  const ticketNumber = Number(formData.get("ticketNumber"));

  try {
    const user = await requireSession();
    await assignTicket(user, ticketNumber);
  } catch (error) {
    if (isAppError(error)) return { error: error.message };
    logger.error({ err: error, ticketNumber }, "falha ao assumir chamado pela fila");
    return { error: "Nao foi possivel assumir o chamado." };
  }

  revalidatePath("/ti/fila");
  return { error: null };
}
