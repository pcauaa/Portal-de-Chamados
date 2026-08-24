"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { TicketStatus, Priority } from "@/generated/prisma/enums";
import { STATUS_META, PRIORITY_META, PRIORITY_ORDER } from "@/config/status";
import {
  assignAction,
  transitionAction,
  changePriorityAction,
  type ActionState,
} from "./actions";

const INITIAL: ActionState = { error: null };

/** Transicoes oferecidas na interface, por status atual. */
const OFFERED: Partial<Record<TicketStatus, TicketStatus[]>> = {
  [TicketStatus.ABERTO]: [TicketStatus.AGUARDANDO_USUARIO, TicketStatus.CANCELADO],
  [TicketStatus.EM_ANDAMENTO]: [
    TicketStatus.RESOLVIDO,
    TicketStatus.AGUARDANDO_USUARIO,
    TicketStatus.CANCELADO,
  ],
  [TicketStatus.AGUARDANDO_USUARIO]: [TicketStatus.EM_ANDAMENTO, TicketStatus.CANCELADO],
  [TicketStatus.RESOLVIDO]: [TicketStatus.FINALIZADO, TicketStatus.EM_ANDAMENTO],
  [TicketStatus.FINALIZADO]: [TicketStatus.EM_ANDAMENTO],
};

/** Destinos que exigem um texto: motivo do cancelamento, solucao ou explicacao. */
const NEEDS_TEXT = new Set<TicketStatus>([
  TicketStatus.RESOLVIDO,
  TicketStatus.CANCELADO,
  TicketStatus.AGUARDANDO_USUARIO,
]);

const TEXT_LABEL: Partial<Record<TicketStatus, string>> = {
  [TicketStatus.RESOLVIDO]: "Descreva a solucao aplicada",
  [TicketStatus.CANCELADO]: "Motivo do cancelamento",
  [TicketStatus.AGUARDANDO_USUARIO]: "O que voce precisa que o solicitante informe?",
};

export function TicketActions({
  ticketNumber,
  status,
  priority,
  hasAssignee,
  isAssignee,
  canAssign,
  canChangeStatus,
  canChangePriority,
}: {
  ticketNumber: number;
  status: TicketStatus;
  priority: Priority;
  hasAssignee: boolean;
  isAssignee: boolean;
  canAssign: boolean;
  canChangeStatus: boolean;
  canChangePriority: boolean;
}) {
  const [assignState, runAssign] = useActionState(assignAction, INITIAL);
  const [transitionState, runTransition] = useActionState(transitionAction, INITIAL);
  const [priorityState, runPriority] = useActionState(changePriorityAction, INITIAL);
  const [pendingTarget, setPendingTarget] = useState<TicketStatus | null>(null);

  const isTerminal = STATUS_META[status].isTerminal;
  const offered = OFFERED[status] ?? [];
  const error = assignState.error ?? transitionState.error ?? priorityState.error;

  return (
    <div className="flex flex-col gap-4 rounded-lg border p-4">
      <h2 className="text-sm font-semibold">Acoes da TI</h2>

      {canAssign && !isTerminal ? (
        <form action={runAssign}>
          <input type="hidden" name="ticketNumber" value={ticketNumber} />
          <AssignButton isAssignee={isAssignee} hasAssignee={hasAssignee} />
        </form>
      ) : null}

      {canChangeStatus && offered.length > 0 ? (
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-muted-foreground">Mudar status</span>
          <div className="flex flex-wrap gap-2">
            {offered.map((target) => (
              <Button
                key={target}
                type="button"
                variant={pendingTarget === target ? "default" : "outline"}
                size="sm"
                onClick={() => setPendingTarget(pendingTarget === target ? null : target)}
              >
                {STATUS_META[target].label}
              </Button>
            ))}
          </div>

          {pendingTarget ? (
            <form action={runTransition} className="mt-1 flex flex-col gap-2">
              <input type="hidden" name="ticketNumber" value={ticketNumber} />
              <input type="hidden" name="to" value={pendingTarget} />

              {NEEDS_TEXT.has(pendingTarget) ? (
                <Textarea
                  name="text"
                  rows={3}
                  required
                  maxLength={4000}
                  placeholder={TEXT_LABEL[pendingTarget]}
                  aria-label={TEXT_LABEL[pendingTarget]}
                />
              ) : null}

              <div className="flex gap-2">
                <ConfirmButton label={`Confirmar: ${STATUS_META[pendingTarget].label}`} />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setPendingTarget(null)}
                >
                  Cancelar
                </Button>
              </div>
            </form>
          ) : null}
        </div>
      ) : null}

      {canChangePriority && !isTerminal ? (
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-muted-foreground">Prioridade</span>
          <div className="flex flex-wrap gap-2">
            {PRIORITY_ORDER.map((option) => (
              <form key={option} action={runPriority}>
                <input type="hidden" name="ticketNumber" value={ticketNumber} />
                <input type="hidden" name="priority" value={option} />
                <Button
                  type="submit"
                  size="sm"
                  variant={option === priority ? "default" : "outline"}
                  disabled={option === priority}
                >
                  {PRIORITY_META[option].label}
                </Button>
              </form>
            ))}
          </div>
        </div>
      ) : null}

      {error ? (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{error}</span>
        </div>
      ) : null}
    </div>
  );
}

function AssignButton({
  isAssignee,
  hasAssignee,
}: {
  isAssignee: boolean;
  hasAssignee: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending || isAssignee} className="w-full">
      {pending ? (
        <>
          <LoaderCircle className="size-4 animate-spin" aria-hidden />
          Assumindo...
        </>
      ) : isAssignee ? (
        "Voce e o responsavel"
      ) : hasAssignee ? (
        "Assumir para mim"
      ) : (
        "Assumir chamado"
      )}
    </Button>
  );
}

function ConfirmButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : null}
      {label}
    </Button>
  );
}
