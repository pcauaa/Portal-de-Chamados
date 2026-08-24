"use server";

import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/guards";
import { isAppError } from "@/lib/http/errors";
import { logger } from "@/lib/logger";
import { saveAttachment, MAX_FILES_PER_TICKET } from "@/lib/storage";
import { createTicketSchema } from "@/modules/tickets/schemas";
import { createTicket, addAttachmentToTicket } from "@/modules/tickets/service";

export type NewTicketFormState = { error: string | null };

/**
 * Abertura de chamado, incluindo os anexos opcionais.
 *
 * Implementada como Server Action (nao como rota /api/v1/tickets) porque este
 * e exatamente o caso que o plano reserva para Server Actions: um formulario
 * isolado, sem necessidade de cache/paginacao/filtros do lado do cliente. O
 * multipart/form-data com os arquivos e tratado nativamente pelo FormData, sem
 * precisar de um parser de upload separado.
 */
export async function createTicketAction(
  _prev: NewTicketFormState,
  formData: FormData,
): Promise<NewTicketFormState> {
  const user = await requireSession();

  const parsed = createTicketSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
    categoryId: formData.get("categoryId"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados invalidos." };
  }

  const files = formData
    .getAll("files")
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);

  if (files.length > MAX_FILES_PER_TICKET) {
    return { error: `Envie no maximo ${MAX_FILES_PER_TICKET} arquivos.` };
  }

  let ticketNumber: number;

  try {
    const ticket = await createTicket(user, parsed.data);

    // Sequencial, nao Promise.all: saveAttachment grava em disco e
    // addAttachmentToTicket abre uma transacao por arquivo - paralelizar
    // aqui so aumentaria a chance de erro de concorrencia sem ganho real
    // (sao no maximo 5 arquivos pequenos).
    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const stored = await saveAttachment(buffer, file.name);
      await addAttachmentToTicket(user, ticket.id, stored);
    }

    ticketNumber = ticket.number;
  } catch (error) {
    if (isAppError(error)) return { error: error.message };
    logger.error({ err: error }, "falha ao criar chamado");
    return { error: "Nao foi possivel abrir o chamado. Tente novamente." };
  }

  redirect(`/chamados?criado=${ticketNumber}`);
}
