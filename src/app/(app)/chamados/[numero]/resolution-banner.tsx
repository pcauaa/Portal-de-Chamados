"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { CircleCheck, CircleX, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TicketStatus } from "@/generated/prisma/enums";
import { transitionAction, type ActionState } from "./actions";

const INITIAL: ActionState = { error: null };

/**
 * O mecanismo que impede o principal fracasso de sistemas de chamado: a TI
 * marca "resolvido", o problema volta, e a discussao migra de volta para o
 * WhatsApp.
 *
 * Aqui o solicitante confirma explicitamente. "Nao resolveu" devolve o chamado
 * para atendimento e incrementa reopenedCount - o que da a TI uma metrica de
 * taxa de reabertura que quase nenhum sistema pequeno tem.
 */
export function ResolutionBanner({
  ticketNumber,
  closingNote,
}: {
  ticketNumber: number;
  closingNote: string | null;
}) {
  const [state, run] = useActionState(transitionAction, INITIAL);

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-cyan-500/30 bg-cyan-50/70 p-4 dark:bg-cyan-500/5">
      <div>
        <p className="font-medium">A TI marcou este chamado como resolvido</p>
        {closingNote ? (
          <p className="mt-1 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Solucao aplicada:</span>{" "}
            {closingNote}
          </p>
        ) : null}
        <p className="mt-2 text-sm text-muted-foreground">
          O problema foi resolvido? Se voce nao responder em 3 dias uteis, o
          chamado sera encerrado automaticamente.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <form action={run}>
          <input type="hidden" name="ticketNumber" value={ticketNumber} />
          <input type="hidden" name="to" value={TicketStatus.FINALIZADO} />
          <ConfirmButton
            variant="default"
            icon={<CircleCheck className="size-4" aria-hidden />}
            label="Sim, resolveu"
          />
        </form>

        <form action={run}>
          <input type="hidden" name="ticketNumber" value={ticketNumber} />
          <input type="hidden" name="to" value={TicketStatus.EM_ANDAMENTO} />
          <ConfirmButton
            variant="outline"
            icon={<CircleX className="size-4" aria-hidden />}
            label="Nao resolveu"
          />
        </form>
      </div>

      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
    </div>
  );
}

function ConfirmButton({
  variant,
  icon,
  label,
}: {
  variant: "default" | "outline";
  icon: React.ReactNode;
  label: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} size="sm" disabled={pending}>
      {pending ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : icon}
      {label}
    </Button>
  );
}
