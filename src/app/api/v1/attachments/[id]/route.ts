import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth/guards";
import { can } from "@/lib/auth/guards";
import { notFound } from "@/lib/http/errors";
import { route, requestMeta } from "@/lib/http/responses";
import { readAttachment } from "@/lib/storage";
import { PERMISSIONS } from "@/config/permissions";
import { logger } from "@/lib/logger";

/**
 * Download de anexo - o UNICO caminho para chegar a um arquivo.
 *
 * Os anexos ficam em storage/, fora de public/: nao existe URL estatica para
 * eles. Cada download passa por sessao valida + escopo do chamado, e fica
 * registrado na auditoria.
 *
 * Se os arquivos estivessem em public/uploads/, qualquer pessoa com o link
 * leria o anexo de qualquer chamado sem login e sem deixar rastro - e chamados
 * de TI carregam print de sistema, dado de folha e documento pessoal.
 */
export const GET = route(
  async (request: Request, context: { params: Promise<{ id: string }> }) => {
    const user = await requireSession();
    const { id } = await context.params;

    const attachment = await db.attachment.findUnique({
      where: { id },
      select: {
        id: true,
        storedName: true,
        originalName: true,
        mimeType: true,
        ticket: { select: { id: true, requesterId: true } },
      },
    });
    if (!attachment) throw notFound("Anexo");

    // Mesmo criterio da tela: quem nao ve o chamado nao baixa o anexo dele.
    const allowed =
      can(user, PERMISSIONS.ATTACHMENT_DOWNLOAD_ALL) ||
      attachment.ticket.requesterId === user.id;
    if (!allowed) throw notFound("Anexo");

    const buffer = await readAttachment(attachment.storedName);

    const meta = requestMeta(request);
    await db.auditLog
      .create({
        data: {
          actorId: user.id,
          eventType: "attachment.downloaded",
          targetType: "attachment",
          targetId: attachment.id,
          ipAddress: meta.ip,
          userAgent: meta.userAgent?.slice(0, 255) ?? null,
        },
      })
      .catch((error) => logger.error({ err: error }, "falha ao auditar download"));

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": attachment.mimeType,
        // attachment (nunca inline): impede que um SVG ou HTML enviado como
        // anexo seja renderizado pelo navegador no dominio do portal, o que
        // permitiria executar script com a sessao do usuario.
        "Content-Disposition": `attachment; filename="${encodeURIComponent(attachment.originalName)}"`,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
      },
    });
  },
);
