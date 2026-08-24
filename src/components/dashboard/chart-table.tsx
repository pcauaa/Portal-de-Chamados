"use client";

import { cn } from "@/lib/utils";

/**
 * Visao em tabela - o gemeo acessivel de cada grafico.
 *
 * Vive em modulo proprio, separado de charts.tsx: e HTML puro, sem nenhuma
 * dependencia do Recharts. Se ficasse no mesmo arquivo, qualquer uso do card
 * (mesmo so para mostrar a tabela) arrastaria os 370 KB do Recharts junto -
 * exatamente o peso que charts-lazy.tsx existe para adiar.
 *
 * Nao e enfeite: o validador marcou o verde-agua abaixo de 3:1 na superficie
 * clara, e a regra de alivio exige rotulo visivel OU tabela. Alem disso, todo
 * valor precisa ser alcancavel sem depender de passar o mouse.
 */
export function ChartTable({
  columns,
  rows,
}: {
  columns: string[];
  rows: (string | number)[][];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left">
            {columns.map((col, index) => (
              <th
                key={col}
                className={cn(
                  "py-1.5 text-xs font-medium text-muted-foreground",
                  index > 0 && "text-right",
                )}
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={String(row[0])} className="border-b last:border-0">
              {row.map((cell, index) => (
                <td
                  key={index}
                  className={cn(
                    "py-1.5",
                    // tabular-nums so em coluna que alinha verticalmente.
                    index > 0 && "text-right tabular-nums",
                  )}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
