"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { LoaderCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

/** Filtros na URL, pelo mesmo motivo da fila: o link do filtro e compartilhavel. */
export function AuditFilters({
  eventTypes,
  actors,
}: {
  eventTypes: { value: string; label: string }[];
  actors: { id: string; name: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function update(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("page"); // filtro novo recomeca na primeira pagina
    startTransition(() => {
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    });
  }

  const tipo = params.get("tipo") ?? "";
  const autor = params.get("autor") ?? "";
  const hasFilters = tipo !== "" || autor !== "";

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border p-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="tipo">Tipo de evento</Label>
        <select
          id="tipo"
          value={tipo}
          onChange={(e) => update("tipo", e.target.value)}
          className="h-8 rounded-lg border border-input bg-background px-2 text-sm"
        >
          <option value="">Todos</option>
          {eventTypes.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="autor">Usuario</Label>
        <select
          id="autor"
          value={autor}
          onChange={(e) => update("autor", e.target.value)}
          className="h-8 rounded-lg border border-input bg-background px-2 text-sm"
        >
          <option value="">Todos</option>
          {actors.map((actor) => (
            <option key={actor.id} value={actor.id}>
              {actor.name}
            </option>
          ))}
        </select>
      </div>

      {hasFilters ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => router.replace(pathname, { scroll: false })}
        >
          <X className="size-3.5" aria-hidden />
          Limpar
        </Button>
      ) : null}

      {isPending ? (
        <LoaderCircle
          className="size-4 animate-spin text-muted-foreground"
          aria-label="Carregando"
        />
      ) : null}
    </div>
  );
}
