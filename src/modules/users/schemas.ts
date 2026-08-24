import { z } from "zod";

export const createUserSchema = z.object({
  name: z.string().trim().min(3, "Informe o nome completo.").max(120),
  email: z.string().trim().toLowerCase().email("E-mail invalido.").max(160),
  roleId: z.string().uuid("Selecione um perfil."),
  departmentId: z.string().uuid().nullable().optional(),
  phone: z.string().trim().max(20).optional().or(z.literal("")),
  /**
   * Senha escolhida pelo admin. Vazia/ausente = o sistema sorteia uma, como
   * sempre fez. A politica (minimo 10 caracteres, nao estar na lista de
   * senhas proibidas) e checada no service via checkPasswordPolicy - aqui so
   * um limite de tamanho, para nao mandar string absurda para o Argon2.
   */
  password: z.string().max(200).optional().or(z.literal("")),
});
export type CreateUserInput = z.infer<typeof createUserSchema>;

export const setPasswordSchema = z.object({
  password: z.string().max(200).optional().or(z.literal("")),
});
export type SetPasswordInput = z.infer<typeof setPasswordSchema>;

export const updateUserSchema = z.object({
  name: z.string().trim().min(3, "Informe o nome completo.").max(120),
  roleId: z.string().uuid("Selecione um perfil."),
  departmentId: z.string().uuid().nullable().optional(),
  phone: z.string().trim().max(20).optional().or(z.literal("")),
});
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
