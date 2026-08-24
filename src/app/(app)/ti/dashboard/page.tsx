import type { Metadata } from "next";
import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import { requirePage } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/config/permissions";
import { TicketStatus } from "@/generated/prisma/enums";
import { getItDashboard, defaultPeriod } from "@/modules/dashboard/it.service";
import { STATUS_META, PRIORITY_META, formatTicketNumber } from "@/config/status";
import { formatDuration, monthLabel } from "@/lib/datetime";
import { StatCard } from "@/components/dashboard/stat-card";
import { ChartCard } from "@/components/dashboard/chart-card";
import {
  MonthlyChart,
  MagnitudeBars,
  PriorityBars,
} from "@/components/dashboard/charts-lazy";
import { StatusBadge } from "@/components/tickets/status-badge";

export const metadata: Metadata = { title: "Indicadores" };

export default async function ItDashboardPage() {
  await requirePage({ permission: PERMISSIONS.DASHBOARD_IT });

  const period = defaultPeriod();
  const data = await getItDashboard(period);

  const monthly = data.monthly.map((row) => ({
    ...row,
    // "2026-07" -> "jul/26". O dia 15 evita que o fuso empurre o rotulo para
    // o mes anterior ao converter.
    label: monthLabel(new Date(`${row.month}-15T12:00:00Z`)),
  }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Indicadores</h1>
        <p className="text-sm text-muted-foreground">
          Ultimos 12 meses &middot; {data.totalPeriod}{" "}
          {data.totalPeriod === 1 ? "chamado" : "chamados"} no periodo.
        </p>
      </div>

      {/* Situacao agora - contadores ao vivo, nao restritos ao periodo */}
      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Abertos"
          value={data.counts[TicketStatus.ABERTO]}
          hint="Aguardando alguem assumir"
          accent={STATUS_META[TicketStatus.ABERTO].chartColor}
          href="/ti/fila?aba=sem-responsavel"
        />
        <StatCard
          label="Em andamento"
          value={data.counts[TicketStatus.EM_ANDAMENTO]}
          accent={STATUS_META[TicketStatus.EM_ANDAMENTO].chartColor}
          href="/ti/fila?aba=todos&status=EM_ANDAMENTO"
        />
        <StatCard
          label="Aguardando usuario"
          value={data.counts[TicketStatus.AGUARDANDO_USUARIO]}
          hint="Relogio pausado"
          accent={STATUS_META[TicketStatus.AGUARDANDO_USUARIO].chartColor}
          href="/ti/fila?aba=aguardando"
        />
        <StatCard
          label="Finalizados"
          value={data.counts[TicketStatus.FINALIZADO]}
          hint={`${data.counts[TicketStatus.CANCELADO]} cancelados`}
          accent={STATUS_META[TicketStatus.FINALIZADO].chartColor}
          href="/ti/fila?aba=todos&status=FINALIZADO"
        />
      </dl>

      {/* Qualidade do atendimento */}
      <dl className="grid gap-3 sm:grid-cols-3">
        <StatCard
          label="Tempo medio de atendimento"
          value={
            data.avgServiceSeconds !== null
              ? formatDuration(Math.round(data.avgServiceSeconds))
              : "-"
          }
          hint="Nao conta o tempo aguardando o solicitante"
        />
        <StatCard
          label="Tempo medio de 1a resposta"
          value={
            data.avgFirstResponseSeconds !== null
              ? formatDuration(Math.round(data.avgFirstResponseSeconds))
              : "-"
          }
          hint="Da abertura ate a TI se manifestar"
        />
        <StatCard
          label="Taxa de reabertura"
          value={`${Math.round(data.reopenRate * 100)}%`}
          hint="Chamados que voltaram apos resolvidos"
        />
      </dl>

      {data.stalled.length > 0 ? (
        <section className="rounded-lg border border-amber-500/30 bg-amber-50/60 p-4 dark:bg-amber-500/5">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <TriangleAlert className="size-4 text-amber-600" aria-hidden />
            Parados ha mais de 3 dias
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Sem nenhuma movimentacao. E aqui que o chamado esquecido aparece.
          </p>
          <ul className="mt-3 flex flex-col gap-2">
            {data.stalled.map((ticket) => (
              <li key={ticket.number} className="flex flex-wrap items-center gap-2 text-sm">
                <Link
                  href={`/chamados/${ticket.number}`}
                  className="font-mono text-xs text-muted-foreground hover:underline"
                >
                  {formatTicketNumber(ticket.number)}
                </Link>
                <Link
                  href={`/chamados/${ticket.number}`}
                  className="min-w-0 flex-1 truncate font-medium hover:underline"
                >
                  {ticket.title}
                </Link>
                <StatusBadge status={ticket.status} />
                <span className="text-xs text-muted-foreground">
                  {ticket.assigneeName ?? "Sem responsavel"} &middot;{" "}
                  {ticket.daysSinceUpdate}d parado
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <ChartCard
        title="Chamados por mes"
        description="Volume aberto e quanto foi finalizado."
        columns={["Mes", "Abertos", "Finalizados"]}
        rows={monthly.map((row) => [row.label, row.abertos, row.finalizados])}
      >
        <MonthlyChart data={monthly} />
      </ChartCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Chamados por categoria"
          description="Onde a TI mais gasta tempo."
          columns={["Categoria", "Chamados"]}
          rows={data.byCategory.map((row) => [row.label, row.value])}
        >
          <MagnitudeBars data={data.byCategory} height={Math.max(200, data.byCategory.length * 30)} />
        </ChartCard>

        <ChartCard
          title="Chamados por prioridade"
          columns={["Prioridade", "Chamados"]}
          rows={data.byPriority.map((row) => [
            PRIORITY_META[row.priority].label,
            row.value,
          ])}
        >
          <PriorityBars
            data={data.byPriority.map((row) => ({
              ...row,
              label: PRIORITY_META[row.priority].label,
            }))}
          />
        </ChartCard>
      </div>

      <ChartCard
        title="Chamados por colaborador"
        description="Quem mais abre chamados - util para identificar necessidade de treinamento."
        columns={["Colaborador", "Chamados"]}
        rows={data.byRequester.map((row) => [row.label, row.value])}
      >
        <MagnitudeBars
          data={data.byRequester}
          height={Math.max(200, data.byRequester.length * 30)}
        />
      </ChartCard>
    </div>
  );
}
