import { TZDate } from "@date-fns/tz";
import { format, formatDistanceToNow, differenceInSeconds } from "date-fns";
import { ptBR } from "date-fns/locale";

/**
 * Datas no sistema.
 *
 * Regra unica: o banco guarda SEMPRE UTC (timestamptz) e a conversao para o
 * fuso local acontece apenas na exibicao. Isso evita a classe de bug mais chata
 * de rastrear - relatorio que muda de resultado no horario de verao, ou chamado
 * aberto 23h50 que aparece no dia seguinte.
 */

export const APP_TIMEZONE = process.env.APP_TIMEZONE ?? "America/Sao_Paulo";

function local(date: Date): TZDate {
  return new TZDate(date, APP_TIMEZONE);
}

/** "29/07/2026 16:45" */
export function formatDateTime(date: Date): string {
  return format(local(date), "dd/MM/yyyy HH:mm", { locale: ptBR });
}

/** "29/07/2026" */
export function formatDate(date: Date): string {
  return format(local(date), "dd/MM/yyyy", { locale: ptBR });
}

/** "29 de julho de 2026 as 16:45" - para o detalhe do chamado. */
export function formatDateTimeLong(date: Date): string {
  return format(local(date), "dd 'de' MMMM 'de' yyyy 'as' HH:mm", {
    locale: ptBR,
  });
}

/** "ha 3 horas" - para a timeline. */
export function formatRelative(date: Date): string {
  return formatDistanceToNow(date, { addSuffix: true, locale: ptBR });
}

/** "2026-07" - chave de agrupamento da serie mensal do dashboard. */
export function monthKey(date: Date): string {
  return format(local(date), "yyyy-MM");
}

/** "jul/26" - rotulo do eixo X do grafico mensal. */
export function monthLabel(date: Date): string {
  return format(local(date), "MMM/yy", { locale: ptBR });
}

/**
 * Converte uma duracao em segundos para texto legivel: "2d 4h", "3h 20min",
 * "45min". Usada no tempo de atendimento e no tempo de primeira resposta.
 */
export function formatDuration(totalSeconds: number): string {
  if (totalSeconds < 0) return "-";
  if (totalSeconds < 60) return "menos de 1min";

  const minutes = Math.floor(totalSeconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    const restHours = hours % 24;
    return restHours > 0 ? `${days}d ${restHours}h` : `${days}d`;
  }
  if (hours > 0) {
    const restMinutes = minutes % 60;
    return restMinutes > 0 ? `${hours}h ${restMinutes}min` : `${hours}h`;
  }
  return `${minutes}min`;
}

/**
 * Tempo de atendimento efetivo de um chamado, em segundos.
 *
 * Desconta o periodo em que o chamado ficou parado aguardando o usuario. Sem
 * esse desconto, um chamado que passou 4 dias esperando resposta apareceria
 * como 4 dias de demora da TI - a metrica ficaria mentirosa e, uma vez que
 * alguem percebe isso, o dashboard inteiro perde a credibilidade.
 *
 * `waitingSince` diferente de null significa que o chamado esta parado NESTE
 * momento; o tempo decorrido desde entao tambem entra no desconto.
 */
export function serviceSeconds(ticket: {
  openedAt: Date;
  closedAt: Date | null;
  waitingSeconds: number;
  waitingSince: Date | null;
}): number {
  const end = ticket.closedAt ?? new Date();
  const gross = differenceInSeconds(end, ticket.openedAt);

  const pendingWait = ticket.waitingSince
    ? differenceInSeconds(end, ticket.waitingSince)
    : 0;

  return Math.max(0, gross - ticket.waitingSeconds - pendingWait);
}

/**
 * Soma dias uteis a uma data (sabado e domingo nao contam).
 *
 * Usada no fechamento automatico de chamados RESOLVIDO. Deliberadamente ignora
 * feriados: manter uma tabela de feriados atualizada e um custo que so se
 * justifica quando existir SLA contratual (Fase 5).
 */
export function addBusinessDays(from: Date, days: number): Date {
  const result = new Date(from);
  let remaining = days;
  while (remaining > 0) {
    result.setDate(result.getDate() + 1);
    const weekday = local(result).getDay();
    if (weekday !== 0 && weekday !== 6) remaining--;
  }
  return result;
}
