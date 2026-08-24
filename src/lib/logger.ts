import pino from "pino";

/**
 * Log estruturado (JSON) em producao, legivel em desenvolvimento.
 *
 * `redact` e o item de seguranca aqui: senha, hash, token de sessao e cookie
 * jamais podem chegar ao arquivo de log. Log de aplicacao costuma ser copiado
 * para anexo de chamado, e-mail e ticket de suporte - e o caminho mais comum
 * para um segredo escapar sem ninguem perceber.
 */
export const logger = pino({
  level:
    process.env.LOG_LEVEL ??
    (process.env.NODE_ENV === "production" ? "info" : "debug"),

  redact: {
    paths: [
      "password",
      "senha",
      "passwordHash",
      "password_hash",
      "token",
      "tokenHash",
      "sessionToken",
      "authorization",
      "cookie",
      "*.password",
      "*.passwordHash",
      "*.token",
      "req.headers.cookie",
      "req.headers.authorization",
    ],
    censor: "[REDIGIDO]",
  },

  base: undefined, // sem pid/hostname: ruido em log de aplicacao web
  timestamp: pino.stdTimeFunctions.isoTime,
});
