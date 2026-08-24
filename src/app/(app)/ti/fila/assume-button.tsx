"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { quickAssignAction, type QueueActionState } from "./actions";

const INITIAL: QueueActionState = { error: null };

export function AssumeButton({ ticketNumber }: { ticketNumber: number }) {
  const [state, run] = useActionState(quickAssignAction, INITIAL);

  return (
    <form action={run}>
      <input type="hidden" name="ticketNumber" value={ticketNumber} />
      <Inner />
      {state.error ? (
        <span role="alert" className="text-xs text-destructive">
          {state.error}
        </span>
      ) : null}
    </form>
  );
}

function Inner() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="xs" variant="outline" disabled={pending}>
      {pending ? (
        <LoaderCircle className="size-3 animate-spin" aria-hidden />
      ) : null}
      Assumir
    </Button>
  );
}
