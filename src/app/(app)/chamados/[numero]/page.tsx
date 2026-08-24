import type { Metadata } from "next";
import Link from "next/link";
import { notFound as nextNotFound } from "next/navigation";
import { ArrowLeft, Paperclip } from "lucide-react";
import { requirePage, can } from "@/lib/auth/guards";
import { isAppError } from "@/lib/http/errors";
import { PERMISSIONS } from "@/config/permissions";
import { TicketStatus } from "@/generated/prisma/enums";
import {
  getTicketByNumber,
  listTicketHistory,
  listTicketAttachments,
} from "@/modules/tickets/queries";
import { listComments } from "@/modules/interactions/comments.service";
import { StatusBadge } from "@/components/tickets/status-badge";
import { PriorityBadge } from "@/components/tickets/priority-badge";
import { CategoryIcon } from "@/components/tickets/category-icon";
import { TicketTimeline } from "@/components/tickets/ticket-timeline";
import { formatTicketNumber, isTerminal } from "@/config/status";
import { formatDateTime, formatDuration, serviceSeconds } from "@/lib/datetime";
import { AutoRefresh } from "@/components/common/auto-refresh";
import { CommentBox } from "./comment-box";
import { TicketActions } from "./ticket-actions";
import { ResolutionBanner } from "./resolution-banner";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ numero: string }>;
}): Promise<Metadata> {
  const { numero } = await params;
  return { title: `Chamado ${formatTicketNumber(Number(numero))}` };
}

/**
 * Detalhe do chamado - a mesma rota para colaborador e TI.
 *
 * Duplicar em /ti/chamados/[id] significaria manter duas telas complexas em
 * sincronia para sempre. Uma tela com paineis condicionais por permissao e
 * menos codigo e menos bug.
 */
export default async function TicketDetailPage({
  params,
}: {
  params: Promise<{ numero: string }>;
}) {
  const user = await requirePage();
  const { numero } = await params;

  const parsedNumber = Number(numero);
  if (!Number.isInteger(parsedNumber) || parsedNumber <= 0) nextNotFound();

  let ticket;
  try {
    ticket = await getTicketByNumber(user, parsedNumber);
  } catch (error) {
    // NOT_FOUND cobre tanto "nao existe" quanto "nao e seu" - de proposito,
    // para nao revelar quais numeros de chamado sao validos.
    if (isAppError(error) && error.code === "NOT_FOUND") nextNotFound();
    throw error;
  }

  const [comments, history, attachments] = await Promise.all([
    listComments(user, ticket.id),
    listTicketHistory(ticket.id),
    listTicketAttachments(ticket.id),
  ]);

  const isRequester = ticket.requesterId === user.id;
  const isAssignee = ticket.assigneeId === user.id;
  const showItPanel =
    can(user, PERMISSIONS.TICKET_ASSIGN) || can(user, PERMISSIONS.TICKET_CHANGE_STATUS);
  const showResolutionBanner = isRequester && ticket.status === TicketStatus.RESOLVIDO;

  return (
    <div className="flex flex-col gap-6">
      {/* A tela onde a conversa acontece: comentario da TI ou mudanca de status
          feita por outra pessoa aparece sozinha, sem precisar de F5. */}
      <AutoRefresh seconds={12} />

      <div>
        <Link
          href="/chamados"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" aria-hidden />
          Voltar
        </Link>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm text-muted-foreground">
            {formatTicketNumber(ticket.number)}
          </span>
          <StatusBadge status={ticket.status} />
          <PriorityBadge priority={ticket.priority} />
        </div>

        <h1 className="mt-1 text-2xl font-semibold tracking-tight">{ticket.title}</h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
        <div className="flex min-w-0 flex-col gap-6">
          <section className="rounded-lg border p-4">
            <h2 className="text-sm font-semibold">Descricao</h2>
            {/* whitespace-pre-wrap preserva as quebras de linha que o usuario
                digitou - sem isso o texto vira um paragrafo unico ilegivel. */}
            <p className="mt-2 whitespace-pre-wrap text-sm">{ticket.description}</p>

            {attachments.length > 0 ? (
              <ul className="mt-4 flex flex-wrap gap-2">
                {attachments.map((file) => (
                  <li key={file.id}>
                    <a
                      href={`/api/v1/attachments/${file.id}`}
                      className="inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs hover:bg-muted"
                    >
                      <Paperclip className="size-3" aria-hidden />
                      {file.originalName}
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>

          {showResolutionBanner ? (
            <ResolutionBanner
              ticketNumber={ticket.number}
              closingNote={ticket.closingNote}
            />
          ) : null}

          <section className="flex flex-col gap-4">
            <h2 className="text-sm font-semibold">Andamento</h2>
            {ticket.purgedAt ? (
              <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                Os comentarios e anexos deste chamado foram removidos
                automaticamente pela politica de retencao de 90 dias. Os dados
                do chamado e a solucao aplicada foram preservados.
              </p>
            ) : (
              <TicketTimeline comments={comments} history={history} />
            )}
          </section>

          {isTerminal(ticket.status) ? (
            <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
              Este chamado esta encerrado. Para tratar do mesmo assunto, reabra-o
              ou abra um novo chamado.
            </p>
          ) : (
            <CommentBox
              ticketNumber={ticket.number}
              canWriteInternal={can(user, PERMISSIONS.COMMENT_INTERNAL)}
              isWaitingOnUser={isRequester && ticket.status === TicketStatus.AGUARDANDO_USUARIO}
            />
          )}
        </div>

        <aside className="flex flex-col gap-4">
          <dl className="flex flex-col gap-3 rounded-lg border p-4 text-sm">
            <Field label="Solicitante" value={ticket.requester.name} />
            <Field label="Setor" value={ticket.department?.name ?? "-"} />
            <Field
              label="Categoria"
              value={
                <span className="inline-flex items-center gap-1.5">
                  <CategoryIcon icon={ticket.category.icon} className="size-3.5" />
                  {ticket.category.name}
                </span>
              }
            />
            <Field label="Responsavel" value={ticket.assignee?.name ?? "Sem responsavel"} />
            <Field label="Aberto em" value={formatDateTime(ticket.openedAt)} />
            <Field
              label="Ultima atualizacao"
              value={formatDateTime(ticket.updatedAt)}
            />
            {ticket.firstResponseAt ? (
              <Field
                label="Primeira resposta"
                value={formatDuration(
                  Math.floor(
                    (ticket.firstResponseAt.getTime() - ticket.openedAt.getTime()) / 1000,
                  ),
                )}
              />
            ) : null}
            {ticket.closedAt ? (
              <Field label="Encerrado em" value={formatDateTime(ticket.closedAt)} />
            ) : null}
            <Field
              label="Tempo de atendimento"
              value={formatDuration(serviceSeconds(ticket))}
              hint={
                ticket.waitingSeconds > 0
                  ? `Nao inclui ${formatDuration(ticket.waitingSeconds)} aguardando o solicitante`
                  : undefined
              }
            />
            {ticket.reopenedCount > 0 ? (
              <Field label="Reaberturas" value={String(ticket.reopenedCount)} />
            ) : null}
          </dl>

          {showItPanel ? (
            <TicketActions
              ticketNumber={ticket.number}
              status={ticket.status}
              priority={ticket.priority}
              hasAssignee={ticket.assigneeId !== null}
              isAssignee={isAssignee}
              canAssign={can(user, PERMISSIONS.TICKET_ASSIGN)}
              canChangeStatus={can(user, PERMISSIONS.TICKET_CHANGE_STATUS)}
              canChangePriority={can(user, PERMISSIONS.TICKET_CHANGE_PRIORITY)}
            />
          ) : null}
        </aside>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
