import { z } from "zod";

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Informe o e-mail.")
    .email("E-mail invalido.")
    .max(160)
    .toLowerCase(),
  password: z.string().min(1, "Informe a senha.").max(200),
});

export type LoginInput = z.infer<typeof loginSchema>;
