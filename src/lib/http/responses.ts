import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { logger } from "@/lib/logger";
import { AppError, isAppError } from "./errors";

/**
 * Envelope unico de erro da API:
 *   { "error": { "code": "...", "message": "...", "details": {...} } }
 *
 * O frontend reage ao `code`, que e estavel, e nao ao texto da mensagem.
 */

export function ok<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}

export function created<T>(data: T): NextResponse {
  return NextResponse.json(data, { status: 201 });
}

export function noContent(): NextResponse {
  return new NextResponse(null, { status: 204 });
}

/**
 * Converte qualquer excecao na resposta HTTP correspondente.
 *
 * Erro NAO previsto vira 500 com mensagem generica: o stack trace fica no log
 * do servidor. Devolver o erro cru ao navegador entrega nome de tabela,
 * caminho de arquivo e versao de biblioteca a quem estiver sondando o sistema.
 */
export function handleApiError(error: unknown): NextResponse {
  if (isAppError(error)) {
    return NextResponse.json(
      {
        error: {
          code: error.code,
          message: error.message,
          ...(error.details ? { details: error.details } : {}),
        },
      },
      { status: error.status },
    );
  }

  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Dados invalidos.",
          details: Object.fromEntries(
            error.issues.map((issue) => [
              issue.path.join(".") || "_",
              issue.message,
            ]),
          ),
        },
      },
      { status: 422 },
    );
  }

  logger.error({ err: error }, "erro nao tratado em rota de API");

  return NextResponse.json(
    {
      error: {
        code: "INTERNAL_ERROR",
        message: "Erro interno. Tente novamente em instantes.",
      },
    },
    { status: 500 },
  );
}

/** Envolve um handler de rota, padronizando o tratamento de erro. */
export function route<Args extends unknown[]>(
  handler: (...args: Args) => Promise<NextResponse>,
) {
  return async (...args: Args): Promise<NextResponse> => {
    try {
      return await handler(...args);
    } catch (error) {
      return handleApiError(error);
    }
  };
}

/** Extrai IP e user-agent para o registro de sessao e auditoria. */
export function requestMeta(request: Request): {
  ip: string | null;
  userAgent: string | null;
} {
  const forwarded = request.headers.get("x-forwarded-for");
  return {
    ip: forwarded?.split(",")[0]?.trim() ?? null,
    userAgent: request.headers.get("user-agent"),
  };
}

export { AppError };
