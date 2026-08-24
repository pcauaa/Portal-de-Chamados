"use client";

import { useActionState, useRef } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, LoaderCircle, Lock, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { commentAction, type ActionState } from "./actions";

const INITIAL: ActionState = { error: null };

export function CommentBox({
  ticketNumber,
  canWriteInternal,
  isWaitingOnUser,
}: {
  ticketNumber: number;
  canWriteInternal: boolean;
  isWaitingOnUser: boolean;
}) {
  const [state, formAction] = useActionState(commentAction, INITIAL);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      action={async (formData) => {
        await formAction(formData);
        formRef.current?.reset();
      }}
      className="flex flex-col gap-3"
    >
      <input type="hidden" name="ticketNumber" value={ticketNumber} />

      {isWaitingOnUser ? (
        <p className="rounded-md bg-purple-500/10 p-3 text-sm text-purple-800 dark:text-purple-300">
          A TI esta aguardando sua resposta. Ao responder, o chamado volta
          automaticamente para atendimento.
        </p>
      ) : null}

      <Textarea
        name="body"
        rows={3}
        required
        maxLength={4000}
        placeholder="Escreva uma resposta..."
        aria-label="Novo comentario"
      />

      {canWriteInternal ? (
        <div className="flex items-center gap-2">
          <Checkbox id="isInternal" name="isInternal" />
          <Label htmlFor="isInternal" className="flex items-center gap-1.5 text-sm font-normal">
            <Lock className="size-3.5 text-muted-foreground" aria-hidden />
            Nota interna (o solicitante nao ve)
          </Label>
        </div>
      ) : null}

      {state.error ? (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{state.error}</span>
        </div>
      ) : null}

      <SubmitButton />
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="self-end">
      {pending ? (
        <>
          <LoaderCircle className="size-4 animate-spin" aria-hidden />
          Enviando...
        </>
      ) : (
        <>
          <Send className="size-4" aria-hidden />
          Enviar
        </>
      )}
    </Button>
  );
}
