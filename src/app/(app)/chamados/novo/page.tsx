import type { Metadata } from "next";
import { requirePage } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/config/permissions";
import { listActiveCategories } from "@/modules/catalog/queries";
import { MAX_FILES_PER_TICKET, MAX_UPLOAD_BYTES } from "@/lib/storage";
import { NewTicketForm } from "./new-ticket-form";

export const metadata: Metadata = { title: "Abrir chamado" };

/**
 * A tela mais importante do sistema.
 *
 * Meta do plano: menos de 60 segundos para abrir um chamado. Se for mais
 * lento que mandar mensagem no WhatsApp, o colaborador volta para o WhatsApp -
 * por isso categoria em cards (nao select), sem escolha de prioridade, e
 * anexo opcional em vez de obrigatorio.
 */
export default async function NewTicketPage() {
  await requirePage({ permission: PERMISSIONS.TICKET_CREATE });
  const categories = await listActiveCategories();

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Abrir chamado</h1>
        <p className="text-sm text-muted-foreground">
          Descreva o problema com o maximo de detalhes que puder - isso ajuda a
          TI a resolver mais rapido.
        </p>
      </div>

      <NewTicketForm
        categories={categories.map((c) => ({
          id: c.id,
          name: c.name,
          description: c.description,
          icon: c.icon,
          defaultPriority: c.defaultPriority,
        }))}
        maxFiles={MAX_FILES_PER_TICKET}
        maxFileBytes={MAX_UPLOAD_BYTES}
      />
    </div>
  );
}
