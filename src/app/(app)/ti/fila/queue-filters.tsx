"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { LoaderCircle, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TicketStatus, Priority } from "@/generated/prisma/enums";
import { STATUS_META, STATUS_ORDER, PRIORITY_META, PRIORITY_ORDER } from "@/config/status";
import { SORT_OPTIONS, type SortOption } from "@/modules/tickets/schemas";
import { cn } from "@/lib/utils";

const SORT_LABEL: Record<SortOption, string> = {
  recentes: "Mais recentes",
  antigos: "Mais antigos",
  prioridade: "Prioridade",
  atualizados: "Atualizados por ultimo",
};

/**
 * Filtros da fila.
 *
 * Todo o estado vive na URL, nao em useState. Isso e o que permite ao tecnico
 * favoritar "meus chamados urgentes" no navegador, compartilhar um link de
 * filtro com um colega, e usar voltar/avancar sem perder o que filtrou.
 */
export function QueueFilters({
  categories,
  technicians,
}: {
  categories: { id: string; name: string }[];
  technicians: { id: string; name: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [search, setSearch] = useState(params.get("q") ?? "");

  // Debounce da busca: sem isso cada tecla dispararia uma navegacao e uma
  // consulta ao banco.
  useEffect(() => {
    const current = params.get("q") ?? "";
    if (search === current) return;

    const timer = setTimeout(() => {
      update({ q: search || null, page: null });
    }, 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  function update(changes: Record<string, string | string[] | null>) {
    const next = new URLSearchParams(params.toString());

    for (const [key, value] of Object.entries(changes)) {
      next.delete(key);
      if (value === null) continue;
      if (Array.isArray(value)) {
        for (const item of value) next.append(key, item);
      } else {
        next.set(key, value);
      }
    }

    startTransition(() => {
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    });
  }

  /** Liga/desliga um valor em um filtro de multipla escolha. */
  function toggleMulti(key: string, value: string) {
    const current = params.getAll(key);
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    update({ [key]: next.length > 0 ? next : null, page: null });
  }

  const activeStatus = params.getAll("status");
  const activePriority = params.getAll("priority");
  const activeCategory = params.getAll("categoryId");
  const activeAssignee = params.get("assigneeId") ?? "";
  const activeSort = (params.get("sort") as SortOption) ?? "recentes";
  const activeFrom = params.get("from") ?? "";
  const activeTo = params.get("to") ?? "";

  const hasFilters =
    activeStatus.length > 0 ||
    activePriority.length > 0 ||
    activeCategory.length > 0 ||
    activeAssignee !== "" ||
    activeFrom !== "" ||
    activeTo !== "" ||
    (params.get("q") ?? "") !== "";

  return (
    <div className="flex flex-col gap-4 rounded-lg border p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor="busca">Buscar</Label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              id="busca"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Titulo ou descricao do chamado..."
              className="pl-8"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ordenar">Ordenar por</Label>
          <select
            id="ordenar"
            value={activeSort}
            onChange={(e) => update({ sort: e.target.value, page: null })}
            className="h-8 rounded-lg border border-border bg-background px-2 text-sm"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {SORT_LABEL[option]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <FilterGroup label="Status">
        {STATUS_ORDER.map((status) => (
          <Chip
            key={status}
            active={activeStatus.includes(status)}
            onClick={() => toggleMulti("status", status)}
          >
            {STATUS_META[status].label}
          </Chip>
        ))}
      </FilterGroup>

      <FilterGroup label="Prioridade">
        {PRIORITY_ORDER.map((priority) => (
          <Chip
            key={priority}
            active={activePriority.includes(priority)}
            onClick={() => toggleMulti("priority", priority)}
          >
            {PRIORITY_META[priority].label}
          </Chip>
        ))}
      </FilterGroup>

      <FilterGroup label="Categoria">
        {categories.map((category) => (
          <Chip
            key={category.id}
            active={activeCategory.includes(category.id)}
            onClick={() => toggleMulti("categoryId", category.id)}
          >
            {category.name}
          </Chip>
        ))}
      </FilterGroup>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="responsavel">Responsavel</Label>
          <select
            id="responsavel"
            value={activeAssignee}
            onChange={(e) =>
              update({ assigneeId: e.target.value || null, aba: null, page: null })
            }
            className="h-8 rounded-lg border border-border bg-background px-2 text-sm"
          >
            <option value="">Qualquer um</option>
            {technicians.map((tech) => (
              <option key={tech.id} value={tech.id}>
                {tech.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="de">Aberto de</Label>
          <Input
            id="de"
            type="date"
            value={activeFrom}
            onChange={(e) => update({ from: e.target.value || null, page: null })}
            className="w-auto"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ate">ate</Label>
          <Input
            id="ate"
            type="date"
            value={activeTo}
            onChange={(e) => update({ to: e.target.value || null, page: null })}
            className="w-auto"
          />
        </div>

        {hasFilters ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearch("");
              router.replace(pathname, { scroll: false });
            }}
          >
            <X className="size-3.5" aria-hidden />
            Limpar filtros
          </Button>
        ) : null}

        {isPending ? (
          <LoaderCircle
            className="size-4 animate-spin text-muted-foreground"
            aria-label="Carregando"
          />
        ) : null}
      </div>
    </div>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1 text-xs font-medium text-muted-foreground">{label}:</span>
      {children}
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
