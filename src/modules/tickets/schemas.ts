import { z } from "zod";
import { Priority, TicketStatus } from "@/generated/prisma/enums";

export const createTicketSchema = z.object({
  title: z
    .string()
    .trim()
    .min(5, "O titulo precisa ter ao menos 5 caracteres.")
    .max(140, "O titulo pode ter no maximo 140 caracteres."),
  description: z
    .string()
    .trim()
    .min(10, "Descreva o problema com mais detalhes.")
    .max(5000),
  categoryId: z.string().uuid("Selecione uma categoria."),
});
export type CreateTicketInput = z.infer<typeof createTicketSchema>;

export const updateTicketSchema = z
  .object({
    title: z.string().trim().min(5).max(140).optional(),
    description: z.string().trim().min(10).max(5000).optional(),
  })
  .refine((data) => data.title !== undefined || data.description !== undefined, {
    message: "Informe ao menos um campo para atualizar.",
  });
export type UpdateTicketInput = z.infer<typeof updateTicketSchema>;

export const changeCategorySchema = z.object({
  categoryId: z.string().uuid(),
});
export type ChangeCategoryInput = z.infer<typeof changeCategorySchema>;

export const changePrioritySchema = z.object({
  priority: z.nativeEnum(Priority),
});
export type ChangePriorityInput = z.infer<typeof changePrioritySchema>;

export const assignTicketSchema = z.object({
  /** Ausente ou null = assumir para si. Presente = atribuir a outro tecnico. */
  assigneeId: z.string().uuid().nullable().optional(),
});
export type AssignTicketInput = z.infer<typeof assignTicketSchema>;

export const transitionSchema = z.object({
  to: z.nativeEnum(TicketStatus),
  /** Solucao aplicada (-> RESOLVIDO) ou motivo do cancelamento (-> CANCELADO). */
  closingNote: z.string().trim().min(1).max(4000).optional(),
  /** Explicacao ao solicitante ao pausar o chamado (-> AGUARDANDO_USUARIO). */
  note: z.string().trim().min(1).max(4000).optional(),
});
export type TransitionInput = z.infer<typeof transitionSchema>;

/**
 * Ordenacoes oferecidas na fila.
 *
 * "prioridade" ordena pelo enum do Postgres, cuja ordem de declaracao no
 * schema e BAIXA < MEDIA < ALTA < URGENTE - por isso desc coloca URGENTE no
 * topo, que e o comportamento util para quem trabalha na fila.
 */
export const SORT_OPTIONS = [
  "recentes",
  "antigos",
  "prioridade",
  "atualizados",
] as const;
export type SortOption = (typeof SORT_OPTIONS)[number];

export const listTicketsQuerySchema = z.object({
  status: z.array(z.nativeEnum(TicketStatus)).optional(),
  priority: z.array(z.nativeEnum(Priority)).optional(),
  categoryId: z.array(z.string().uuid()).optional(),
  assigneeId: z.string().uuid().optional(),
  /** Apenas chamados sem responsavel - a aba mais usada da fila. */
  unassigned: z.boolean().optional(),
  requesterId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
  q: z.string().trim().max(140).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  sort: z.enum(SORT_OPTIONS).default("recentes"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type ListTicketsQuery = z.infer<typeof listTicketsQuerySchema>;
