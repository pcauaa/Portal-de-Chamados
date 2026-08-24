import { Lock, MessageSquare, Paperclip } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { formatDateTime, formatRelative } from "@/lib/datetime";
import { cn } from "@/lib/utils";
import type { TicketComment } from "@/modules/interactions/comments.service";
import type { TicketHistoryEntry } from "@/modules/tickets/queries";

/**
 * Timeline unificada: comentarios e eventos de historico intercalados em
 * ordem cronologica.
 *
 * Juntar os dois e o que substitui a conversa do WhatsApp: o colaborador ve
 * "voce abriu", "Fulano assumiu", "Fulano perguntou X", "voce respondeu" numa
 * unica leitura, em vez de ter que cruzar duas listas separadas.
 */

type TimelineEntry =
  | { kind: "comment"; at: Date; comment: TicketComment }
  | { kind: "event"; at: Date; event: TicketHistoryEntry };

export function TicketTimeline({
  comments,
  history,
}: {
  comments: TicketComment[];
  history: TicketHistoryEntry[];
}) {
  const entries: TimelineEntry[] = [
    ...comments.map((c) => ({ kind: "comment" as const, at: c.createdAt, comment: c })),
    // Eventos ja representados por um comentario visivel sao omitidos, senao a
    // timeline mostraria "comentou" logo acima do proprio comentario.
    ...history
      .filter((h) => h.eventType !== "comment.created")
      .map((h) => ({ kind: "event" as const, at: h.createdAt, event: h })),
  ].sort((a, b) => a.at.getTime() - b.at.getTime());

  if (entries.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        Nenhuma movimentacao ainda.
      </p>
    );
  }

  return (
    <ol className="flex flex-col gap-4">
      {entries.map((entry) =>
        entry.kind === "comment" ? (
          <CommentItem key={`c-${entry.comment.id}`} comment={entry.comment} />
        ) : (
          <EventItem key={`e-${entry.event.id}`} event={entry.event} />
        ),
      )}
    </ol>
  );
}

function CommentItem({ comment }: { comment: TicketComment }) {
  return (
    <li
      className={cn(
        "rounded-lg border p-4",
        comment.isInternal
          ? "border-amber-500/30 bg-amber-50/60 dark:bg-amber-500/5"
          : "bg-card",
      )}
    >
      <div className="flex items-center gap-2">
        <Avatar className="size-6">
          <AvatarFallback className="text-[10px]">
            {initials(comment.author.name)}
          </AvatarFallback>
        </Avatar>
        <span className="text-sm font-medium">{comment.author.name}</span>

        {comment.isInternal ? (
          <span className="inline-flex items-center gap-1 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-700 dark:text-amber-400">
            <Lock className="size-2.5" aria-hidden />
            Nota interna
          </span>
        ) : null}

        <time
          className="ml-auto text-xs text-muted-foreground"
          dateTime={comment.createdAt.toISOString()}
          title={formatDateTime(comment.createdAt)}
        >
          {formatRelative(comment.createdAt)}
        </time>
      </div>

      {/* rehype-sanitize com allowlist: o Markdown do usuario nunca vira HTML
          arbitrario. Sem isso, um comentario com <script> ou um link
          javascript: executaria no navegador de quem abrisse o chamado.

          Estilos escritos a mao em vez de @tailwindcss/typography: sao poucos
          elementos (comentario de chamado nao e artigo), e o plugin traria
          uma dependencia inteira para formatar tres tags. */}
      <div
        className={cn(
          "mt-2 text-sm",
          "[&_p]:my-1 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0",
          "[&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-5",
          "[&_ol]:my-1 [&_ol]:list-decimal [&_ol]:pl-5",
          "[&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2",
          "[&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-xs",
          "[&_pre]:overflow-x-auto [&_pre]:rounded [&_pre]:bg-muted [&_pre]:p-2",
          "[&_strong]:font-semibold",
          "[&_blockquote]:border-l-2 [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground",
        )}
      >
        <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
          {comment.body}
        </ReactMarkdown>
      </div>

      {comment.attachments.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-2">
          {comment.attachments.map((file) => (
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
    </li>
  );
}

function EventItem({ event }: { event: TicketHistoryEntry }) {
  return (
    <li className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
      <MessageSquare className="size-3 shrink-0" aria-hidden />
      <span>
        <strong className="font-medium text-foreground">
          {event.actor?.name ?? "Sistema"}
        </strong>{" "}
        {describeEvent(event)}
      </span>
      <time
        className="ml-auto shrink-0"
        dateTime={event.createdAt.toISOString()}
        title={formatDateTime(event.createdAt)}
      >
        {formatRelative(event.createdAt)}
      </time>
    </li>
  );
}

/** Converte o evento tecnico em uma frase legivel para o colaborador. */
function describeEvent(event: TicketHistoryEntry): string {
  switch (event.eventType) {
    case "ticket.created":
      return "abriu o chamado";
    case "ticket.assigned":
      return event.newValue
        ? `atribuiu o chamado para ${event.newValue}`
        : "removeu o responsavel";
    case "ticket.status_changed":
      return `mudou o status de ${event.oldValue} para ${event.newValue}`;
    case "ticket.priority_changed":
      return `mudou a prioridade de ${event.oldValue} para ${event.newValue}`;
    case "ticket.category_changed":
      return `mudou a categoria de ${event.oldValue} para ${event.newValue}`;
    case "ticket.reopened":
      return "reabriu o chamado";
    case "ticket.edited":
      return `editou ${event.field === "title" ? "o titulo" : "a descricao"}`;
    case "attachment.added":
      return `anexou ${event.newValue}`;
    case "ticket.rated":
      return `avaliou o atendimento (${event.newValue})`;
    default:
      return event.eventType;
  }
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}
