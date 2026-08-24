import "server-only";
import { randomBytes } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { AppError, notFound } from "@/lib/http/errors";
import { assertCan } from "@/lib/auth/guards";
import { checkPasswordPolicy, hashPassword } from "@/lib/auth/password";
import { revokeAllSessions } from "@/lib/auth/session";
import { deleteAttachment } from "@/lib/storage";
import type { SessionUser } from "@/lib/auth/session";
import { PERMISSIONS } from "@/config/permissions";
import { logger } from "@/lib/logger";
import type { CreateUserInput, UpdateUserInput } from "./schemas";

/**
 * Gestao de usuarios.
 *
 * Duas regras estruturam este modulo:
 *
 * 1. Desativar e o caminho PADRAO. Um usuario e autor de chamados e
 *    comentarios; desativar corta o acesso na hora e preserva todo o
 *    historico. A exclusao definitiva existe (deleteUser), mas e a excecao
 *    consciente, nao o padrao - e leva junto tudo o que a pessoa produziu.
 *
 * 2. Toda acao administrativa passa pela auditoria. Quem criou, quem desativou,
 *    quem redefiniu senha de quem - e a diferenca entre um sistema interno
 *    auditavel e um sistema onde ninguem sabe explicar o que aconteceu.
 */

/** Senha temporaria legivel: sem caracteres ambiguos (O/0, l/1). */
function temporaryPassword(): string {
  const alfabeto = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = randomBytes(14);
  return Array.from(bytes, (b) => alfabeto[b % alfabeto.length]).join("");
}

async function audit(
  actorId: string,
  eventType: string,
  targetId: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        actorId,
        eventType,
        targetType: "user",
        targetId,
        metadata: (metadata ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
  } catch (error) {
    logger.error({ err: error, eventType }, "falha ao gravar auditoria de usuario");
  }
}

export async function createUser(
  admin: SessionUser,
  input: CreateUserInput,
): Promise<{ id: string; password: string; wasGenerated: boolean }> {
  assertCan(admin, PERMISSIONS.USER_MANAGE);

  const existing = await db.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw new AppError(
      "CONFLICT",
      existing.isActive
        ? "Ja existe um usuario com este e-mail."
        : "Existe um usuario desativado com este e-mail. Reative-o em vez de criar outro.",
    );
  }

  // Campo em branco = comportamento de sempre (sorteia). Preenchido = o admin
  // escolheu, e sabe qual e a senha porque foi ele quem digitou - resolve o
  // problema real de a senha sorteada aparecer uma unica vez e se perder se a
  // tela fechar antes de ser copiada.
  const chosen = input.password?.trim() || "";
  const wasGenerated = chosen === "";
  if (!wasGenerated) {
    const policy = checkPasswordPolicy(chosen);
    if (!policy.ok) throw new AppError("VALIDATION_ERROR", policy.reason);
  }
  const senha = wasGenerated ? temporaryPassword() : chosen;

  const user = await db.user.create({
    data: {
      name: input.name,
      email: input.email,
      passwordHash: await hashPassword(senha),
      roleId: input.roleId,
      departmentId: input.departmentId || null,
      phone: input.phone || null,
    },
  });

  await audit(admin.id, "user.created", user.id, { email: input.email, wasGenerated });

  return { id: user.id, password: senha, wasGenerated };
}

export async function updateUser(
  admin: SessionUser,
  userId: string,
  input: UpdateUserInput,
): Promise<void> {
  assertCan(admin, PERMISSIONS.USER_MANAGE);

  const target = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, roleId: true },
  });
  if (!target) throw notFound("Usuario");

  // Um admin nao pode rebaixar a si mesmo: se ele for o unico, o sistema fica
  // sem ninguem capaz de gerenciar usuarios.
  if (userId === admin.id && input.roleId !== target.roleId) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Voce nao pode alterar o proprio perfil de acesso. Peca a outro administrador.",
    );
  }

  await db.user.update({
    where: { id: userId },
    data: {
      name: input.name,
      roleId: input.roleId,
      departmentId: input.departmentId || null,
      phone: input.phone || null,
    },
  });

  await audit(admin.id, "user.updated", userId);
}

/**
 * Ativa ou desativa. Desativar revoga as sessoes ativas na hora - sem isso, o
 * usuario continuaria navegando com a sessao que ja tinha aberta.
 */
export async function setUserActive(
  admin: SessionUser,
  userId: string,
  isActive: boolean,
): Promise<void> {
  assertCan(admin, PERMISSIONS.USER_MANAGE);

  if (userId === admin.id && !isActive) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Voce nao pode desativar a propria conta.",
    );
  }

  const target = await db.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });
  if (!target) throw notFound("Usuario");

  await db.user.update({ where: { id: userId }, data: { isActive } });

  let revoked = 0;
  if (!isActive) revoked = await revokeAllSessions(userId);

  await audit(admin.id, isActive ? "user.activated" : "user.deactivated", userId, {
    sessoesRevogadas: revoked,
  });
}

/**
 * Sorteia uma senha nova e devolve para o admin repassar.
 *
 * Revoga as sessoes: se o motivo da redefinicao for suspeita de acesso
 * indevido, deixar a sessao do invasor viva tornaria a troca inutil.
 *
 * A senha sorteada e a senha da conta a partir daqui - o usuario nao tem tela
 * para troca-la, entao quem quiser uma senha memoravel usa setUserPassword.
 */
export async function resetPassword(
  admin: SessionUser,
  userId: string,
): Promise<string> {
  assertCan(admin, PERMISSIONS.USER_MANAGE);

  const target = await db.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });
  if (!target) throw notFound("Usuario");

  const senha = temporaryPassword();

  await db.user.update({
    where: { id: userId },
    data: {
      passwordHash: await hashPassword(senha),
      failedLoginCount: 0,
      lockedUntil: null,
    },
  });

  const revoked = await revokeAllSessions(userId);
  await audit(admin.id, "user.password_reset", userId, { sessoesRevogadas: revoked });

  return senha;
}

/**
 * Define a senha escolhida pelo admin (em vez de sortear uma).
 *
 * Existe ao lado de resetPassword, nao no lugar dela: quando o admin nao tem
 * uma senha em mente, sortear continua sendo o caminho mais rapido. Esta
 * funcao serve exatamente o caso em que ele quer digitar algo que ele mesmo
 * vai lembrar ou repassar verbalmente - sem depender de a tela nao fechar
 * antes de copiar uma senha sorteada.
 *
 * Revoga sessoes ativas e audita, igual a resetPassword. A senha em claro nunca
 * e persistida nem logada - so existe no argumento desta chamada.
 */
export async function setUserPassword(
  admin: SessionUser,
  userId: string,
  novaSenha: string,
): Promise<void> {
  assertCan(admin, PERMISSIONS.USER_MANAGE);

  const senha = novaSenha.trim();
  if (!senha) {
    throw new AppError("VALIDATION_ERROR", "Informe a nova senha.");
  }
  const policy = checkPasswordPolicy(senha);
  if (!policy.ok) throw new AppError("VALIDATION_ERROR", policy.reason);

  const target = await db.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });
  if (!target) throw notFound("Usuario");

  await db.user.update({
    where: { id: userId },
    data: {
      passwordHash: await hashPassword(senha),
      failedLoginCount: 0,
      lockedUntil: null,
    },
  });

  const revoked = await revokeAllSessions(userId);
  await audit(admin.id, "user.password_set", userId, { sessoesRevogadas: revoked });
}

/** Destrava uma conta bloqueada por excesso de tentativas, sem trocar a senha. */
export async function unlockUser(admin: SessionUser, userId: string): Promise<void> {
  assertCan(admin, PERMISSIONS.USER_MANAGE);

  await db.user.update({
    where: { id: userId },
    data: { failedLoginCount: 0, lockedUntil: null },
  });

  await audit(admin.id, "user.unlocked", userId);
}

/**
 * Exclusao definitiva.
 *
 * As FKs de autoria (chamado, comentario, anexo) sao `Restrict` de proposito -
 * o banco recusa apagar alguem que produziu conteudo. Para excluir de verdade e
 * preciso remover esse conteudo primeiro, na ordem certa. Nada disso volta.
 *
 * Continua valendo: quando a pessoa apenas saiu da empresa, DESATIVAR e o certo
 * (preserva o historico e as metricas). Excluir e para conta criada por engano
 * ou usuario de teste.
 */
export async function deleteUser(
  admin: SessionUser,
  userId: string,
): Promise<{ chamadosRemovidos: number; comentariosRemovidos: number }> {
  assertCan(admin, PERMISSIONS.USER_MANAGE);

  if (userId === admin.id) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Voce nao pode excluir a propria conta.",
    );
  }

  const target = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true },
  });
  if (!target) throw notFound("Usuario");

  // Arquivos em disco nao morrem com o Cascade do banco: e preciso colher os
  // caminhos ANTES de apagar as linhas, senao a referencia se perde e o arquivo
  // fica orfao ocupando espaco para sempre.
  const arquivos = await db.attachment.findMany({
    where: {
      OR: [{ uploaderId: userId }, { ticket: { requesterId: userId } }],
    },
    select: { storedName: true },
  });

  const resultado = await db.$transaction(async (tx) => {
    // 1. Chamados abertos pela pessoa. O Cascade leva junto os comentarios,
    //    anexos e historico DESSES chamados.
    const chamados = await tx.ticket.deleteMany({ where: { requesterId: userId } });

    // 2. O que ela produziu em chamados de OUTRAS pessoas - esses chamados
    //    continuam existindo, entao o Cascade acima nao os alcanca.
    const comentarios = await tx.ticketComment.deleteMany({
      where: { authorId: userId },
    });
    await tx.attachment.deleteMany({ where: { uploaderId: userId } });

    // 3. A conta. Sessoes caem por Cascade; historico e auditoria em que ela
    //    aparece como ator viram SetNull (o evento fica, sem o nome).
    await tx.user.delete({ where: { id: userId } });

    return { chamados: chamados.count, comentarios: comentarios.count };
  });

  // Fora da transacao: I/O de disco nao pode segurar lock de banco, e uma falha
  // ao remover arquivo nao deve desfazer a exclusao ja confirmada.
  for (const arquivo of arquivos) {
    await deleteAttachment(arquivo.storedName);
  }

  // targetId aponta para um usuario que nao existe mais - proposital. O
  // registro precisa sobreviver justamente para explicar o que aconteceu.
  await audit(admin.id, "user.deleted", userId, {
    nome: target.name,
    email: target.email,
    chamadosRemovidos: resultado.chamados,
    comentariosRemovidos: resultado.comentarios,
    arquivosRemovidos: arquivos.length,
  });

  logger.warn(
    { admin: admin.id, alvo: userId, ...resultado },
    "usuario excluido definitivamente",
  );

  return {
    chamadosRemovidos: resultado.chamados,
    comentariosRemovidos: resultado.comentarios,
  };
}
