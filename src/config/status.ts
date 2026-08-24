import { TicketStatus, Priority } from "@/generated/prisma/enums";

/**
 * Metadados de status e prioridade usados na interface inteira.
 *
 * Centralizar aqui garante que o mesmo chamado tenha a mesma cor e o mesmo
 * rotulo na fila, no card, no grafico e no e-mail. Cada entrada carrega
 * `label` alem da cor porque cor sozinha nao comunica: cerca de 8% dos homens
 * tem alguma forma de daltonismo, entao o badge sempre exibe texto.
 */

export type StatusMeta = {
  label: string;
  /** Frase curta para tooltip e telas de ajuda. */
  description: string;
  /** Classes Tailwind do badge (claro + escuro). */
  className: string;
  /** Cor solida para os graficos do Recharts. */
  chartColor: string;
  /** Status terminal: nao aceita mais comentario nem transicao. */
  isTerminal: boolean;
  /** O relogio de atendimento corre neste status? */
  clockRunning: boolean;
};

export const STATUS_META: Record<TicketStatus, StatusMeta> = {
  [TicketStatus.ABERTO]: {
    label: "Aberto",
    description: "Aguardando um tecnico assumir.",
    className:
      "bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-300",
    chartColor: "#2563eb",
    isTerminal: false,
    clockRunning: true,
  },
  [TicketStatus.EM_ANDAMENTO]: {
    label: "Em andamento",
    description: "Um tecnico esta trabalhando no chamado.",
    className:
      "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
    chartColor: "#d97706",
    isTerminal: false,
    clockRunning: true,
  },
  [TicketStatus.AGUARDANDO_USUARIO]: {
    label: "Aguardando usuario",
    description: "A TI pediu mais informacoes e aguarda sua resposta.",
    className:
      "bg-purple-100 text-purple-800 dark:bg-purple-500/15 dark:text-purple-300",
    chartColor: "#7c3aed",
    isTerminal: false,
    // O relogio para: o tempo que o usuario leva para responder nao pode ser
    // contabilizado como lentidao da TI.
    clockRunning: false,
  },
  [TicketStatus.RESOLVIDO]: {
    label: "Resolvido",
    description: "A TI aplicou a solucao e aguarda sua confirmacao.",
    className:
      "bg-cyan-100 text-cyan-800 dark:bg-cyan-500/15 dark:text-cyan-300",
    chartColor: "#0891b2",
    isTerminal: false,
    clockRunning: false,
  },
  [TicketStatus.FINALIZADO]: {
    label: "Finalizado",
    description: "Chamado encerrado e confirmado.",
    className:
      "bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-300",
    chartColor: "#16a34a",
    isTerminal: true,
    clockRunning: false,
  },
  [TicketStatus.CANCELADO]: {
    label: "Cancelado",
    description: "Chamado encerrado sem solucao.",
    className:
      "bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300",
    chartColor: "#64748b",
    isTerminal: true,
    clockRunning: false,
  },
};

export type PriorityMeta = {
  label: string;
  className: string;
  chartColor: string;
  /** Ordem de urgencia: maior = mais urgente. Usada na ordenacao da fila. */
  weight: number;
};

export const PRIORITY_META: Record<Priority, PriorityMeta> = {
  [Priority.BAIXA]: {
    label: "Baixa",
    className:
      "bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300",
    chartColor: "#64748b",
    weight: 1,
  },
  [Priority.MEDIA]: {
    label: "Media",
    className:
      "bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-300",
    chartColor: "#2563eb",
    weight: 2,
  },
  [Priority.ALTA]: {
    label: "Alta",
    className:
      "bg-orange-100 text-orange-800 dark:bg-orange-500/15 dark:text-orange-300",
    chartColor: "#ea580c",
    weight: 3,
  },
  [Priority.URGENTE]: {
    label: "Urgente",
    className: "bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300",
    chartColor: "#dc2626",
    weight: 4,
  },
};

/** Ordem de exibicao nos filtros e abas da fila. */
export const STATUS_ORDER: TicketStatus[] = [
  TicketStatus.ABERTO,
  TicketStatus.EM_ANDAMENTO,
  TicketStatus.AGUARDANDO_USUARIO,
  TicketStatus.RESOLVIDO,
  TicketStatus.FINALIZADO,
  TicketStatus.CANCELADO,
];

export const PRIORITY_ORDER: Priority[] = [
  Priority.URGENTE,
  Priority.ALTA,
  Priority.MEDIA,
  Priority.BAIXA,
];

/** Status considerados "em aberto" para contadores e para a fila padrao. */
export const OPEN_STATUSES: TicketStatus[] = [
  TicketStatus.ABERTO,
  TicketStatus.EM_ANDAMENTO,
  TicketStatus.AGUARDANDO_USUARIO,
  TicketStatus.RESOLVIDO,
];

export function isTerminal(status: TicketStatus): boolean {
  return STATUS_META[status].isTerminal;
}

/** Formata o numero do chamado para exibicao: 123 -> "#000123". */
export function formatTicketNumber(number: number): string {
  return `#${String(number).padStart(6, "0")}`;
}
