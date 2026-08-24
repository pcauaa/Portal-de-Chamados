/**
 * Redireciona a resolucao do pacote "server-only" para um modulo vazio.
 *
 * Fora do pipeline de build do Next.js, "server-only" sempre lanca um erro (o
 * truque depende do webpack/turbopack do Next trocar o arquivo por um no-op
 * ao empacotar para o servidor). Este hook permite rodar os services
 * (retention.service.ts, etc.) diretamente via tsx/node em um script agendado,
 * sem alterar nenhum arquivo em node_modules.
 *
 * Usado por scripts/retencao.ps1 via NODE_OPTIONS="--require ./scripts/server-only-shim.cjs".
 */
const Module = require("module");
const path = require("path");

const noopPath = path.join(__dirname, "server-only-noop.cjs");
const originalResolveFilename = Module._resolveFilename;

Module._resolveFilename = function (request, ...rest) {
  if (request === "server-only") return noopPath;
  return originalResolveFilename.call(this, request, ...rest);
};
