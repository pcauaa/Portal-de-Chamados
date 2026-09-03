import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { AppError } from "@/lib/http/errors";
import { logger } from "@/lib/logger";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import type { LoginInput } from "./schemas";

/**
 * Regras de autenticacao.
 *
 * O objetivo aqui nao e apenas "conferir a senha": e tornar o login caro para
 * quem estiver tentando adivinhar, sem tornar o sistema irritante para quem
 * usa o portal todo dia.
 */

/**
 * Limiares do bloqueio por tentativas erradas.
 *
 * Afrouxado para rede interna: com poucas dezenas de colaboradores e sem exposicao externa,
 * o risco real de forca bruta e baixo, e um bloqueio agressivo vira a propria
 * fonte de chamado para a TI (colaborador erra a senha 3 vezes seguidas e
 * fica travado 15 min). 10 tentativas/3 min ainda barra um script automatizado
 * insistente, sem punir quem so errou de digitar - e toda tentativa falha
 * continua indo para a auditoria, entao o padrao de uso indevido fica visivel
 * mesmo sem o bloqueio duro.
 */
const MAX_FAILED_ATTEMPTS = 10;
const LOCK_MINUTES = 3;

/**
 * Hash descartavel usado para equalizar o tempo de resposta.
 *
 * Sem isso, um e-mail inexistente responde em ~1 ms (nao ha hash a conferir) e
 * um e-mail valido em ~80 ms (Argon2 rodando). Essa diferenca e suficiente para
 * enumerar quais e-mails existem na empresa, mesmo com a mensagem de erro
 * identica nos dois casos.
 */
const DUMMY_HASH_PROMISE = hashPassword("senha-descartavel-para-timing");

type LoginContext = { ip?: string | null; userAgent?: string | null };

export async function login(
  input: LoginInput,
  context: LoginContext = {},
): Promise<void> {
  const user = await db.user.findUnique({
    where: { email: input.email },
    select: {
      id: true,
      passwordHash: true,
      isActive: true,
      failedLoginCount: true,
      lockedUntil: true,
    },
  });

  if (!user) {
    await verifyPassword(await DUMMY_HASH_PROMISE, input.password);
    await audit(null, "login.failed", context, { email: input.email, motivo: "inexistente" });
    throw invalidCredentials();
  }

  /**
   * Conta bloqueada: aqui a mensagem e explicita, ao contrario das demais.
   *
   * Isso revela que o e-mail existe - uma concessao consciente. O sistema roda
   * na rede interna, sem exposicao externa, e a alternativa (usuario real
   * tentando a mesma senha correta em looping, sem entender por que falha) gera
   * chamado para a propria TI. Se um dia o portal for publicado para fora,
   * esta e a primeira mensagem a se tornar generica.
   */
  if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
    const minutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
    await audit(user.id, "login.blocked", context);
    throw new AppError(
      "ACCOUNT_LOCKED",
      `Conta temporariamente bloqueada por excesso de tentativas. Tente novamente em ${minutes} min.`,
    );
  }

  const passwordOk = await verifyPassword(user.passwordHash, input.password);

  if (!passwordOk) {
    const attempts = user.failedLoginCount + 1;
    const shouldLock = attempts >= MAX_FAILED_ATTEMPTS;

    await db.user.update({
      where: { id: user.id },
      data: {
        failedLoginCount: shouldLock ? 0 : attempts,
        lockedUntil: shouldLock
          ? new Date(Date.now() + LOCK_MINUTES * 60_000)
          : null,
      },
    });

    await audit(user.id, "login.failed", context, { tentativa: attempts });
    throw invalidCredentials();
  }

  // Conta desativada: mensagem generica de proposito. Um ex-funcionario nao
  // precisa saber se o acesso foi removido ou se errou a senha.
  if (!user.isActive) {
    await audit(user.id, "login.inactive", context);
    throw invalidCredentials();
  }

  await db.user.update({
    where: { id: user.id },
    data: {
      failedLoginCount: 0,
      lockedUntil: null,
      lastLoginAt: new Date(),
    },
  });

  await createSession(user.id, context);
  await audit(user.id, "login.success", context);
}

/**
 * Nao existe troca de senha pelo proprio usuario: a senha e sempre definida
 * pelo admin, em Administracao > Usuarios. Quem esquecer a senha abre chamado
 * com a TI, que redefine por la. Isso mantem um unico caminho para senha no
 * sistema, com auditoria e revogacao de sessao garantidas
 * (src/modules/users/service.ts).
 */

/** Registro de auditoria. Falha aqui nunca derruba a operacao principal. */
async function audit(
  actorId: string | null,
  eventType: string,
  context: LoginContext,
  metadata?: Record<string, unknown>,
): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        actorId,
        eventType,
        ipAddress: context.ip ?? null,
        userAgent: context.userAgent?.slice(0, 255) ?? null,
        metadata: (metadata ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
  } catch (error) {
    logger.error({ err: error, eventType }, "falha ao gravar auditoria");
  }
}

/** Mensagem deliberadamente vaga: nao revela se o e-mail existe. */
function invalidCredentials(): AppError {
  return new AppError("INVALID_CREDENTIALS", "E-mail ou senha invalidos.");
}
