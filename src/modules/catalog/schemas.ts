import { z } from "zod";
import { Priority } from "@/generated/prisma/enums";

export const categorySchema = z.object({
  name: z.string().trim().min(2, "Informe o nome da categoria.").max(60),
  description: z.string().trim().max(200).optional().or(z.literal("")),
  icon: z.string().trim().max(40).default("circle-help"),
  defaultPriority: z.nativeEnum(Priority),
  /** Prazo alvo em horas. Vazio = sem SLA definido (Fase 5). */
  slaHours: z.coerce.number().int().min(1).max(720).nullable().optional(),
});
export type CategoryInput = z.infer<typeof categorySchema>;

export const departmentSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome do setor.").max(80),
});
export type DepartmentInput = z.infer<typeof departmentSchema>;
