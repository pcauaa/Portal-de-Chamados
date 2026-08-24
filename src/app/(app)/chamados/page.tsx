import Link from "next/link";
import type { Metadata } from "next";
import { CheckCircle2, Inbox } from "lucide-react";
import { requirePage } from "@/lib/auth/guards";
import { listTickets } from "@/modules/tickets/queries";
import { OPEN_STATUSES, formatTicketNumber } from "@/config/status";
import { TicketStatus } from "@/generated/prisma/enums";
import { StatusBadge } from "@/components/tickets/status-badge";
import { PriorityBadge } from "@/components/tickets/priority-badge";
import { CategoryIcon } from "@/components/tickets/category-icon";
import { formatDate } from "@/lib/datetime";
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

export const metadata: Metadata = { title: "Meus chamados" };

const TABS = [
  { key: "abertos", label: "Em aberto" },
  { key: "encerrados", label: "Encerrados" },
  { key: "todos", label: "Todos" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export default async function MyTicketsPage({
  searchParams,
}: {
  searchParams: Promise<{ aba?: string; criado?: string }>;
}) {
  const user = await requirePage();
  const { aba: abaParam, criado } = await searchParams;
  const aba: TabKey = TABS.some((t) => t.key === abaParam) ? (abaParam as TabKey) : "abertos";

  const statusFilter =
    aba === "encerrados"
      ? [TicketStatus.FINALIZADO, TicketStatus.CANCELADO]
      : aba === "todos"
        ? undefined
        : OPEN_STATUSES;

  // requesterId explicito: garante "meus chamados" mesmo quando quem esta
  // olhando e um tecnico (que por padrao enxergaria todos os chamados).
  const { items, total } = await listTickets(user, {
    requesterId: user.id,
    status: statusFilter,
    sort: "recentes",
    page: 1,
    pageSize: 50,
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Meus chamados</h1>
          <p className="text-sm text-muted-foreground">
            Acompanhe o andamento dos chamados que voce abriu.
          </p>
        </div>
        <Button render={<Link href="/chamados/novo" />}>Abrir chamado</Button>
      </div>

      {criado ? (
        <div className="flex items-center gap-2 rounded-md border border-green-600/20 bg-green-50 p-3 text-sm text-green-800 dark:bg-green-500/10 dark:text-green-300">
          <CheckCircle2 className="size-4 shrink-0" aria-hidden />
          Chamado {formatTicketNumber(Number(criado))} aberto com sucesso.
        </div>
      ) : null}

      <nav className="flex gap-1 border-b" aria-label="Filtrar chamados">
        {TABS.map((tab) => (
          <Link
            key={tab.key}
            href={`/chamados?aba=${tab.key}`}
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

      {items.length === 0 ? (
        <EmptyState aba={aba} />
      ) : (
        <>
          {/* Tabela em telas medias e maiores */}
          <div className="hidden overflow-x-auto rounded-lg border md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Numero</TableHead>
                  <TableHead>Titulo</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Prioridade</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Responsavel</TableHead>
                  <TableHead>Aberto em</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((ticket) => (
                  <TableRow key={ticket.id}>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      <Link
                        href={`/chamados/${ticket.number}`}
                        className="hover:underline"
                      >
                        {formatTicketNumber(ticket.number)}
                      </Link>
                    </TableCell>
                    <TableCell className="max-w-xs truncate font-medium">
                      <Link
                        href={`/chamados/${ticket.number}`}
                        className="hover:underline"
                      >
                        {ticket.title}
                      </Link>
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
                      {ticket.assignee?.name ?? "Sem responsavel"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(ticket.openedAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Cards em telas pequenas - tabela larga viraria rolagem horizontal incomoda no celular */}
          <div className="flex flex-col gap-3 md:hidden">
            {items.map((ticket) => (
              <Link
                key={ticket.id}
                href={`/chamados/${ticket.number}`}
                className="rounded-lg border p-4 transition-colors hover:bg-muted/60"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-mono text-xs text-muted-foreground">
                      {formatTicketNumber(ticket.number)}
                    </p>
                    <p className="truncate font-medium">{ticket.title}</p>
                  </div>
                  <StatusBadge status={ticket.status} className="shrink-0" />
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <CategoryIcon icon={ticket.category.icon} className="size-3.5" />
                    {ticket.category.name}
                  </span>
                  <PriorityBadge priority={ticket.priority} />
                  <span>{formatDate(ticket.openedAt)}</span>
                </div>
              </Link>
            ))}
          </div>

          <p className="text-xs text-muted-foreground">
            {total} {total === 1 ? "chamado" : "chamados"}
          </p>
        </>
      )}
    </div>
  );
}

function EmptyState({ aba }: { aba: TabKey }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-10 text-center">
      <Inbox className="size-8 text-muted-foreground" aria-hidden />
      <div>
        <p className="font-medium">
          {aba === "todos" ? "Nenhum chamado ainda" : "Nada por aqui"}
        </p>
        <p className="text-sm text-muted-foreground">
          {aba === "todos"
            ? "Quando voce abrir um chamado, ele aparece aqui."
            : "Nenhum chamado nesta categoria no momento."}
        </p>
      </div>
      <Button render={<Link href="/chamados/novo" />}>Abrir o primeiro chamado</Button>
    </div>
  );
}
