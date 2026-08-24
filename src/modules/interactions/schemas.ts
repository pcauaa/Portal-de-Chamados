import { z } from "zod";

export const createCommentSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, "Escreva alguma coisa antes de enviar.")
    .max(4000, "Comentario muito longo."),
  /** Nota interna: so quem tem comment.internal escreve e le. */
  isInternal: z.coerce.boolean().default(false),
});

export type CreateCommentInput = z.infer<typeof createCommentSchema>;
