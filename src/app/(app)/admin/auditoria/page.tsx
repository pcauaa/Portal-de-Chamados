import type { Metadata } from "next";
import Link from "next/link";
import { ScrollText, ShieldAlert } from "lucide-react";
import { requirePage } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/config/permissions";
import {
  listAuditLogs,
  listAuditEventTypes,
  listAuditActors,
  auditLabel,
  isSecurityEvent,
} from "@/modules/audit/queries";
import { formatDateTime } from "@/lib/datetime";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { AuditFilters } from "./audit-filters";

export const metadata: Metadata = { title: "Auditoria" };

const PAGE_SIZE = 50;

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string; autor?: string; page?: string }>;
}) {
  await requirePage({ permission: PERMISSIONS.AUDIT_VIEW });
  const sp = await searchParams;

  const page = Math.max(1, Number(sp.page) || 1);

  const [{ items, total }, eventTypes, actors] = await Promise.all([
    listAuditLogs({
      eventType: sp.tipo || undefined,
      actorId: sp.autor || undefined,
      page,
      pageSize: PAGE_SIZE,
    }),
    listAuditEventTypes(),
    listAuditActors(),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Auditoria</h1>
        <p className="text-sm text-muted-foreground">
          Eventos do sistema: acessos, gestao de usuarios e downloads de anexo.
          O historico de cada chamado fica na propria tela do chamado.
        </p>
      </div>

      <AuditFilters
        eventTypes={eventTypes.map((type) => ({ value: type, label: auditLabel(type) }))}
        actors={actors}
      />

      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed p-10 text-center">
          <ScrollText className="size-8 text-muted-foreground" aria-hidden />
          <p className="font-medium">Nenhum evento encontrado</p>
          <p className="text-sm text-muted-foreground">Ajuste os filtros acima.</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quando</TableHead>
                  <TableHead>Evento</TableHead>
                  <TableHead>Quem</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead>Detalhes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground tabular-nums">
                      {formatDateTime(entry.createdAt)}
                    </TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 text-sm",
                          isSecurityEvent(entry.eventType) && "font-medium text-amber-700 dark:text-amber-400",
                        )}
                      >
                        {isSecurityEvent(entry.eventType) ? (
                          <ShieldAlert className="size-3.5 shrink-0" aria-hidden />
                        ) : null}
                        {auditLabel(entry.eventType)}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm">
                      {entry.actor ? (
                        <>
                          <span className="block">{entry.actor.name}</span>
                          <span className="block text-xs text-muted-foreground">
                            {entry.actor.email}
                          </span>
                        </>
                      ) : (
                        <span className="text-muted-foreground italic">Sistema</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground tabular-nums">
                      {entry.ipAddress ?? "-"}
                    </TableCell>
                    <TableCell className="max-w-xs text-xs text-muted-foreground">
                      {formatMetadata(entry.metadata)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between gap-4">
            <p className="text-xs text-muted-foreground">
              {total} {total === 1 ? "evento" : "eventos"}
              {totalPages > 1 ? ` - pagina ${page} de ${totalPages}` : ""}
            </p>
            {totalPages > 1 ? (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  render={<Link href={pageUrl(sp, page - 1)} />}
                >
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  render={<Link href={pageUrl(sp, page + 1)} />}
                >
                  Proxima
                </Button>
              </div>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Renderiza o metadata jsonb de forma legivel.
 *
 * O log guarda o que cada evento tinha de util no momento; como o formato varia
 * por tipo de evento, exibimos pares chave/valor em vez de tentar um layout
 * fixo que quebraria a cada evento novo.
 */
function formatMetadata(metadata: unknown): string {
  if (!metadata || typeof metadata !== "object") return "-";
  const entries = Object.entries(metadata as Record<string, unknown>);
  if (entries.length === 0) return "-";
  return entries.map(([key, value]) => `${key}: ${String(value)}`).join(" · ");
}

function pageUrl(
  sp: { tipo?: string; autor?: string },
  page: number,
): string {
  const params = new URLSearchParams();
  if (sp.tipo) params.set("tipo", sp.tipo);
  if (sp.autor) params.set("autor", sp.autor);
  params.set("page", String(page));
  return `/admin/auditoria?${params.toString()}`;
}
