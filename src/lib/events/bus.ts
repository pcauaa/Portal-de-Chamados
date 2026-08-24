import type { PrismaClient } from "@/generated/prisma/client";
import type { Prisma } from "@/generated/prisma/client";
import { logger } from "@/lib/logger";
import { historyHandler } from "./handlers/history.handler";
import type { DomainEvent, EventHandler } from "./types";

/**
 * Barramento de eventos de dominio.
 *
 * Duas categorias de handler, com garantias diferentes de proposito:
 *
 * CRITICOS  - rodam DENTRO da transacao do chamado. Se um falhar, a operacao
 *             inteira e desfeita. Hoje ha exatamente um, o historico: chamado
 *             alterado sem registro de auditoria seria pior do que a alteracao
 *             nao ter acontecido.
 *
 * EFEITO    - rodam DEPOIS do commit, com falha isolada e apenas logada. Um
 * COLATERAL   servidor SMTP fora do ar nunca pode impedir um colaborador de
 *             abrir um chamado. Notificar antes do commit tambem seria errado:
 *             geraria e-mail sobre um chamado que a transacao acabou revertendo.
 *
 * O coletor e criado por operacao (nao no escopo do modulo) porque o servidor
 * atende varias requisicoes ao mesmo tempo: uma lista compartilhada faria os
 * eventos de um chamado serem despachados no contexto de outro.
 */

const criticalHandlers: EventHandler[] = [historyHandler];

const sideEffectHandlers: EventHandler[] = [
  // Fase 3: notificationHandler
  // Fase 4: emailHandler
  // Fase 6: teamsHandler, whatsappHandler
];

export type EventCollector = {
  /** Emite dentro da transacao. Roda os handlers criticos na hora. */
  emit: (event: DomainEvent, tx: Prisma.TransactionClient) => Promise<void>;
  /** Dispara os efeitos colaterais. Chamar somente apos o commit. */
  flush: (db: PrismaClient) => Promise<void>;
};

export function createEventCollector(): EventCollector {
  const collected: DomainEvent[] = [];

  return {
    async emit(event, tx) {
      for (const handler of criticalHandlers) {
        await handler(event, tx);
      }
      collected.push(event);
    },

    async flush(db) {
      if (sideEffectHandlers.length === 0) return;

      for (const event of collected) {
        for (const handler of sideEffectHandlers) {
          try {
            await handler(event, db);
          } catch (error) {
            logger.error(
              { err: error, eventType: event.type, ticketId: event.ticketId },
              "handler de efeito colateral falhou",
            );
          }
        }
      }
      collected.length = 0;
    },
  };
}

/** Ponto de extensao usado pelas fases futuras para plugar uma integracao. */
export function registerSideEffectHandler(handler: EventHandler): void {
  sideEffectHandlers.push(handler);
}
