/**
 * Erros de aplicacao.
 *
 * Todo erro previsto e uma AppError com um `code` estavel. A API converte isso
 * no envelope { error: { code, message } }, e o frontend pode reagir ao codigo
 * sem depender do texto da mensagem (que muda, e que um dia sera traduzido).
 *
 * Erro NAO previsto vira 500 com mensagem generica: o stack trace vai para o
 * log do servidor e nunca para o navegador, porque mensagem de erro detalhada
 * e uma fonte classica de vazamento (nome de tabela, caminho de arquivo,
 * versao de biblioteca).
 */

export type AppErrorCode =
  // 401
  | "UNAUTHENTICATED"
  | "SESSION_EXPIRED"
  // 403
  | "FORBIDDEN"
  | "PASSWORD_CHANGE_REQUIRED"
  // 404
  | "NOT_FOUND"
  // 400 / 422
  | "VALIDATION_ERROR"
  | "INVALID_TRANSITION"
  | "TICKET_TERMINAL"
  | "ASSIGNEE_REQUIRED"
  | "CLOSING_NOTE_REQUIRED"
  | "COMMENT_REQUIRED"
  // upload
  | "FILE_TOO_LARGE"
  | "FILE_TYPE_NOT_ALLOWED"
  | "TOO_MANY_FILES"
  // login
  | "INVALID_CREDENTIALS"
  | "ACCOUNT_LOCKED"
  | "ACCOUNT_INACTIVE"
  // 409
  | "CONFLICT"
  | "IN_USE";

const STATUS_BY_CODE: Record<AppErrorCode, number> = {
  UNAUTHENTICATED: 401,
  SESSION_EXPIRED: 401,
  FORBIDDEN: 403,
  PASSWORD_CHANGE_REQUIRED: 403,
  NOT_FOUND: 404,
  VALIDATION_ERROR: 422,
  INVALID_TRANSITION: 422,
  TICKET_TERMINAL: 422,
  ASSIGNEE_REQUIRED: 422,
  CLOSING_NOTE_REQUIRED: 422,
  COMMENT_REQUIRED: 422,
  FILE_TOO_LARGE: 413,
  FILE_TYPE_NOT_ALLOWED: 415,
  TOO_MANY_FILES: 422,
  INVALID_CREDENTIALS: 401,
  ACCOUNT_LOCKED: 423,
  ACCOUNT_INACTIVE: 403,
  CONFLICT: 409,
  IN_USE: 409,
};

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly status: number;
  readonly details?: Record<string, unknown>;

  constructor(
    code: AppErrorCode,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = STATUS_BY_CODE[code];
    this.details = details;
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

// --- Atalhos para os erros mais frequentes ----------------------------------

export const unauthenticated = () =>
  new AppError("UNAUTHENTICATED", "Voce precisa entrar para continuar.");

export const forbidden = (message = "Voce nao tem permissao para esta acao.") =>
  new AppError("FORBIDDEN", message);

/**
 * Recurso inexistente OU sem permissao de acesso - propositalmente o mesmo
 * erro. Responder 403 para um chamado que existe e 404 para um que nao existe
 * revelaria, para quem esta sondando, quais numeros de chamado sao validos.
 */
export const notFound = (what = "Registro") =>
  new AppError("NOT_FOUND", `${what} nao encontrado.`);
