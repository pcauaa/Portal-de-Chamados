"use client";

import { useState } from "react";
import { ChartColumn, Table2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ChartTable } from "./chart-table";

/**
 * Card de grafico com alternancia para tabela.
 *
 * A tabela nao e opcional: e o gemeo acessivel exigido quando alguma cor fica
 * abaixo de 3:1 na superficie, e garante que todo valor seja legivel sem
 * depender de hover (que nao existe em toque nem em leitor de tela).
 */
export function ChartCard({
  title,
  description,
  columns,
  rows,
  children,
}: {
  title: string;
  description?: string;
  columns: string[];
  rows: (string | number)[][];
  children: React.ReactNode;
}) {
  const [view, setView] = useState<"grafico" | "tabela">("grafico");

  return (
    <section className="flex flex-col gap-3 rounded-lg border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          {description ? (
            <p className="text-xs text-muted-foreground">{description}</p>
          ) : null}
        </div>

        <div
          className="flex shrink-0 rounded-md border p-0.5"
          role="group"
          aria-label={`Visualizacao de ${title}`}
        >
          <ViewButton
            active={view === "grafico"}
            onClick={() => setView("grafico")}
            label="Grafico"
          >
            <ChartColumn className="size-3.5" aria-hidden />
          </ViewButton>
          <ViewButton
            active={view === "tabela"}
            onClick={() => setView("tabela")}
            label="Tabela"
          >
            <Table2 className="size-3.5" aria-hidden />
          </ViewButton>
        </div>
      </div>

      {view === "grafico" ? children : <ChartTable columns={columns} rows={rows} />}
    </section>
  );
}

function ViewButton({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={label}
      title={label}
      className={cn(
        "rounded p-1 transition-colors",
        active
          ? "bg-muted text-foreground"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
