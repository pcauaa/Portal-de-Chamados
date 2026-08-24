import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { deleteAttachment } from "@/lib/storage";
import { logger } from "@/lib/logger";
import { TicketStatus } from "@/generated/prisma/enums";

/**
 * Retencao de 90 dias.
 *
 * O que sai: anexos (arquivo + registro), comentarios e historico de
 * chamados ENCERRADOS ha mais de N dias.
 *
 * O que fica: o chamado em si - numero, titulo, descricao, categoria,
 * prioridade, solicitante, responsavel, todas as datas e `closingNote` (a
 * solucao aplicada). O dashboard de indicadores olha 12 meses; apagar o
 * chamado inteiro destruiria essa serie. O banco todo pesa poucos MB mesmo
 * com centenas de chamados - quem cresce de verdade sao os anexos em disco,
 * entao e neles que a limpeza foca.
 *
 * Elegibilidade exige DOIS filtros independentes: status terminal
 * (FINALIZADO/CANCELADO) E closedAt preenchido ha mais de `days` dias. A
 * ancora e closedAt, nunca updatedAt - updatedAt muda a cada edicao e nao
 * representa "quando encerrou". Chamado em andamento nunca e tocado, por
 * mais antigo que seja.
 *
 * Marca `purgedAt` para nao reprocessar o mesmo chamado toda noite - sem
 * isso o job varreria os mesmos IDs indefinidamente.
 */

export type PurgeResult = {
  chamados: number;
  comentarios: number;
  historico: number;
  anexosRegistro: number;
  arquivosRemovidos: number;
  falhasArquivo: number;
};

export async function purgeOldTicketContent(options?: {
  days?: number;
  dryRun?: boolean;
}): Promise<PurgeResult> {
  const days = options?.days ?? 90;
  const dryRun = options?.dryRun ?? false;

  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const candidates = await db.ticket.findMany({
    where: {
      status: { in: [TicketStatus.FINALIZADO, TicketStatus.CANCELADO] },
      closedAt: { lt: cutoff },
      purgedAt: null,
    },
    select: {
      id: true,
      number: true,
      _count: { select: { comments: true, history: true, attachments: true } },
      attachments: { select: { storedName: true } },
    },
  });

  const result: PurgeResult = {
    chamados: candidates.length,
    comentarios: candidates.reduce((sum, t) => sum + t._count.comments, 0),
    historico: candidates.reduce((sum, t) => sum + t._count.history, 0),
    anexosRegistro: candidates.reduce((sum, t) => sum + t._count.attachments, 0),
    arquivosRemovidos: 0,
    falhasArquivo: 0,
  };

  if (candidates.length === 0 || dryRun) return result;

  const ticketIds = candidates.map((t) => t.id);
  // Coletado ANTES do delete: o Cascade do banco apaga o registro de
  // `attachments`, mas nao toca no arquivo em disco. Depois do delete essa
  // informacao nao existe mais em lugar nenhum.
  const storedNames = candidates.flatMap((t) => t.attachments.map((a) => a.storedName));

  await db.$transaction(async (tx) => {
    await tx.attachment.deleteMany({ where: { ticketId: { in: ticketIds } } });
    await tx.ticketComment.deleteMany({ where: { ticketId: { in: ticketIds } } });
    await tx.ticketHistory.deleteMany({ where: { ticketId: { in: ticketIds } } });
    await tx.ticket.updateMany({
      where: { id: { in: ticketIds } },
      data: { purgedAt: new Date() },
    });
  });

  // Fora da transacao, de proposito: I/O de disco nao pode segurar um lock de
  // banco, e um rollback do Postgres nao desfaz um unlink() no filesystem -
  // as duas operacoes tem garantias diferentes e nao devem fingir ser atomicas.
  for (const storedName of storedNames) {
    try {
      await deleteAttachment(storedName);
      result.arquivosRemovidos++;
    } catch (error) {
      result.falhasArquivo++;
      logger.error({ err: error, storedName }, "falha ao remover arquivo na retencao");
    }
  }

  await db.auditLog
    .create({
      data: {
        actorId: null, // job de sistema, sem usuario por tras
        eventType: "retention.purged",
        targetType: "ticket",
        targetId: null,
        metadata: {
          days,
          chamados: result.chamados,
          comentarios: result.comentarios,
          historico: result.historico,
          anexosRegistro: result.anexosRegistro,
          arquivosRemovidos: result.arquivosRemovidos,
          falhasArquivo: result.falhasArquivo,
          numeros: candidates.map((t) => t.number),
        } as Prisma.InputJsonValue,
      },
    })
    .catch((error) => logger.error({ err: error }, "falha ao registrar auditoria de retencao"));

  return result;
}
