import type { Metadata } from "next";
import Link from "next/link";
import { Inbox } from "lucide-react";
import { requirePage } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/config/permissions";
import { TicketStatus } from "@/generated/prisma/enums";
import { listTickets, listTechnicians } from "@/modules/tickets/queries";
import { listActiveCategories } from "@/modules/catalog/queries";
import { listTicketsQuerySchema } from "@/modules/tickets/schemas";
import { OPEN_STATUSES, formatTicketNumber } from "@/config/status";
import { StatusBadge } from "@/components/tickets/status-badge";
import { PriorityBadge } from "@/components/tickets/priority-badge";
import { CategoryIcon } from "@/components/tickets/category-icon";
import { formatDate, formatRelative } from "@/lib/datetime";
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
import { AutoRefresh } from "@/components/common/auto-refresh";
import { QueueFilters } from "./queue-filters";
import { AssumeButton } from "./assume-button";

export const metadata: Metadata = { title: "Fila de atendimento" };

const PAGE_SIZE = 25;

const TABS = [
  { key: "abertos", label: "Em aberto" },
  { key: "sem-responsavel", label: "Sem responsavel" },
  { key: "meus", label: "Meus" },
  { key: "aguardando", label: "Aguardando usuario" },
  { key: "todos", label: "Todos" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export default async function QueuePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requirePage({ permission: PERMISSIONS.TICKET_VIEW_ALL });
  const sp = await searchParams;

  const aba: TabKey = TABS.some((t) => t.key === sp.aba) ? (sp.aba as TabKey) : "abertos";

  const [categories, technicians] = await Promise.all([
    listActiveCategories(),
    listTechnicians(),
  ]);

  // A aba define o recorte base; os filtros refinam dentro dele.
  const tabFilters =
    aba === "sem-responsavel"
      ? { unassigned: true, status: OPEN_STATUSES }
      : aba === "meus"
        ? { assigneeId: user.id, status: OPEN_STATUSES }
        : aba === "aguardando"
          ? { status: [TicketStatus.AGUARDANDO_USUARIO] }
          : aba === "todos"
            ? {}
            : { status: OPEN_STATUSES };

  const parsed = listTicketsQuerySchema.safeParse({
    ...tabFilters,
    // Filtros explicitos da URL vencem os da aba (ex.: aba "Em aberto" +
    // status "Resolvido" marcado nos chips).
    ...(toArray(sp.status).length > 0 ? { status: toArray(sp.status) } : {}),
    ...(toArray(sp.priority).length > 0 ? { priority: toArray(sp.priority) } : {}),
    ...(toArray(sp.categoryId).length > 0 ? { categoryId: toArray(sp.categoryId) } : {}),
    ...(typeof sp.assigneeId === "string" && sp.assigneeId
      ? { assigneeId: sp.assigneeId, unassigned: undefined }
      : {}),
    ...(typeof sp.q === "string" && sp.q ? { q: sp.q } : {}),
    ...(typeof sp.from === "string" && sp.from ? { from: sp.from } : {}),
    ...(typeof sp.to === "string" && sp.to ? { to: sp.to } : {}),
    ...(typeof sp.sort === "string" ? { sort: sp.sort } : {}),
    page: typeof sp.page === "string" ? sp.page : 1,
    pageSize: PAGE_SIZE,
  });

  // Filtro invalido na URL (link antigo, alguem editando a mao) nao pode
  // derrubar a tela de trabalho: cai no padrao em vez de lancar erro.
  const filters = parsed.success
    ? parsed.data
    : listTicketsQuerySchema.parse({ status: OPEN_STATUSES, page: 1, pageSize: PAGE_SIZE });

  const { items, total, page } = await listTickets(user, filters);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="flex flex-col gap-6">
      {/* Tela de trabalho compartilhada: chamado novo ou assumido por outro
          tecnico aparece sozinho. Intervalo maior que o do detalhe porque aqui
          a consulta e mais pesada e a urgencia e menor. */}
      <AutoRefresh seconds={30} />

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Fila de atendimento</h1>
        <p className="text-sm text-muted-foreground">
          Todos os chamados da empresa. Use os filtros para focar no que importa agora.
        </p>
      </div>

      <nav className="flex flex-wrap gap-1 border-b" aria-label="Recortes da fila">
        {TABS.map((tab) => (
          <Link
            key={tab.key}
            href={`/ti/fila?aba=${tab.key}`}
            aria-current={aba === tab.key ? "page" : undefined}
            className={cn(
              "border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              aba === tab.key
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      <QueueFilters
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
        technicians={technicians}
      />

      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed p-10 text-center">
          <Inbox className="size-8 text-muted-foreground" aria-hidden />
          <p className="font-medium">Nenhum chamado encontrado</p>
          <p className="text-sm text-muted-foreground">
            Ajuste os filtros ou escolha outra aba.
          </p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Numero</TableHead>
                  {/* Solicitante vive dentro desta celula: com coluna propria,
                      a tabela de 9 colunas estourava a largura util e cortava
                      justamente o botao "Assumir", a acao mais usada da tela. */}
                  <TableHead>Chamado</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Prioridade</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Responsavel</TableHead>
                  <TableHead>Aberto</TableHead>
                  <TableHead className="text-right">Acao</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((ticket) => (
                  <TableRow key={ticket.id}>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      <Link href={`/chamados/${ticket.number}`} className="hover:underline">
                        {formatTicketNumber(ticket.number)}
                      </Link>
                    </TableCell>
                    <TableCell className="max-w-sm">
                      <Link
                        href={`/chamados/${ticket.number}`}
                        className="block truncate font-medium hover:underline"
                      >
                        {ticket.title}
                      </Link>
                      <span className="block truncate text-xs text-muted-foreground">
                        {ticket.requester.name}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                        <CategoryIcon icon={ticket.category.icon} className="size-3.5" />
                        {ticket.category.name}
                      </span>
                    </TableCell>
                    <TableCell>
                      <PriorityBadge priority={ticket.priority} />
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={ticket.status} />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {ticket.assignee?.name ?? (
                        <span className="italic">Ninguem</span>
                      )}
                    </TableCell>
                    <TableCell
                      className="whitespace-nowrap text-sm text-muted-foreground"
                      title={formatDate(ticket.openedAt)}
                    >
                      {formatRelative(ticket.openedAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      {ticket.assigneeId === null ? (
                        <AssumeButton ticketNumber={ticket.number} />
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between gap-4">
            <p className="text-xs text-muted-foreground">
              {total} {total === 1 ? "chamado" : "chamados"}
              {totalPages > 1 ? ` - pagina ${page} de ${totalPages}` : ""}
            </p>

            {totalPages > 1 ? (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  render={<Link href={buildPageUrl(sp, page - 1)} />}
                >
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  render={<Link href={buildPageUrl(sp, page + 1)} />}
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

function toArray(value: string | string[] | undefined): string[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

/** Preserva todos os filtros ao trocar de pagina. */
function buildPageUrl(
  sp: Record<string, string | string[] | undefined>,
  page: number,
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    if (key === "page" || value === undefined) continue;
    if (Array.isArray(value)) {
      for (const item of value) params.append(key, item);
    } else {
      params.set(key, value);
    }
  }
  params.set("page", String(page));
  return `/ti/fila?${params.toString()}`;
}
