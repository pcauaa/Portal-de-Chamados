import type { Metadata } from "next";
import Link from "next/link";
import { CirclePlus, Inbox } from "lucide-react";
import { requirePage, can } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/config/permissions";
import { TicketStatus } from "@/generated/prisma/enums";
import { getPersonalDashboard } from "@/modules/dashboard/personal.service";
import { STATUS_META, formatTicketNumber } from "@/config/status";
import { formatDate } from "@/lib/datetime";
import { StatCard } from "@/components/dashboard/stat-card";
import { StatusBadge } from "@/components/tickets/status-badge";
import { CategoryIcon } from "@/components/tickets/category-icon";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Painel" };

export default async function DashboardPage() {
  const user = await requirePage();
  const data = await getPersonalDashboard(user.id);

  const aguardandoResposta = data.aguardandoResposta > 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Ola, {user.name.split(" ")[0]}
          </h1>
          <p className="text-sm text-muted-foreground">
            Acompanhe seus chamados com o setor de TI.
          </p>
        </div>

        {can(user, PERMISSIONS.TICKET_CREATE) ? (
          <Button render={<Link href="/chamados/novo" />}>
            <CirclePlus className="size-4" aria-hidden />
            Abrir chamado
          </Button>
        ) : null}
      </div>

      {/* Acao pendente do usuario vem antes de tudo: e o unico item da tela
          que depende dele para o chamado voltar a andar. */}
      {aguardandoResposta ? (
        <Link
          href="/chamados?aba=abertos"
          className="rounded-lg border border-purple-500/30 bg-purple-50/70 p-4 transition-colors hover:bg-purple-100/70 dark:bg-purple-500/5 dark:hover:bg-purple-500/10"
        >
          <p className="font-medium">
            {data.aguardandoResposta === 1
              ? "1 chamado aguarda sua resposta"
              : `${data.aguardandoResposta} chamados aguardam sua resposta`}
          </p>
          <p className="text-sm text-muted-foreground">
            A TI precisa de mais informacoes para continuar. Enquanto voce nao
            responder, esses chamados ficam parados.
          </p>
        </Link>
      ) : null}

      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total de chamados" value={data.total} href="/chamados?aba=todos" />
        <StatCard
          label="Abertos"
          value={data.abertos}
          accent={STATUS_META[TicketStatus.ABERTO].chartColor}
          href="/chamados?aba=abertos"
        />
        <StatCard
          label="Em andamento"
          value={data.emAndamento}
          accent={STATUS_META[TicketStatus.EM_ANDAMENTO].chartColor}
          href="/chamados?aba=abertos"
        />
        <StatCard
          label="Finalizados"
          value={data.finalizados}
          accent={STATUS_META[TicketStatus.FINALIZADO].chartColor}
          href="/chamados?aba=encerrados"
        />
      </dl>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Chamados recentes</h2>
          {data.recent.length > 0 ? (
            <Link href="/chamados" className="text-sm text-muted-foreground hover:underline">
              Ver todos
            </Link>
          ) : null}
        </div>

        {data.recent.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-10 text-center">
            <Inbox className="size-8 text-muted-foreground" aria-hidden />
            <div>
              <p className="font-medium">Nenhum chamado ainda</p>
              <p className="text-sm text-muted-foreground">
                Precisa de ajuda da TI? Abra um chamado - leva menos de um minuto.
              </p>
            </div>
            <Button render={<Link href="/chamados/novo" />}>Abrir o primeiro chamado</Button>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {data.recent.map((ticket) => (
              <li key={ticket.number}>
                <Link
                  href={`/chamados/${ticket.number}`}
                  className="flex flex-wrap items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/60"
                >
                  <span className="font-mono text-xs text-muted-foreground">
                    {formatTicketNumber(ticket.number)}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-medium">
                    {ticket.title}
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                    <CategoryIcon icon={ticket.categoryIcon} className="size-3.5" />
                    {ticket.categoryName}
                  </span>
                  <StatusBadge status={ticket.status} />
                  <span className="text-xs text-muted-foreground">
                    {formatDate(ticket.openedAt)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
