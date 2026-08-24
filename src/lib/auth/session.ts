import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";
import type { Permission } from "@/config/permissions";

/**
 * Sessao propria, persistida no banco.
 *
 * Por que nao JWT: com JWT o servidor nao consegue invalidar um token antes de
 * ele expirar - um funcionario desligado continuaria dentro do sistema ate o
 * fim da validade. Com sessao em tabela, apagar a linha derruba o acesso no
 * mesmo segundo. Nesta escala (poucas dezenas de usuarios), a consulta extra por requisicao e irrelevante.
 *
 * Por que nao Auth.js: o unico metodo e e-mail + senha. A biblioteca traz
 * OAuth, adapters e um contrato ainda em beta ha cerca de dois anos, para
 * resolver um problema que aqui cabe em pouco mais de cem linhas.
 */

const COOKIE_NAME = "chamados_session";
const TOKEN_BYTES = 32; // 256 bits
/** Atualiza last_seen_at no maximo a cada 5 min, para nao escrever a cada request. */
const TOUCH_INTERVAL_MS = 5 * 60 * 1000;

function ttlHours(): number {
  const raw = Number(process.env.SESSION_TTL_HOURS);
  return Number.isFinite(raw) && raw > 0 ? raw : 8;
}

/**
 * Hash do token de sessao.
 *
 * O banco guarda apenas o SHA-256 do token, com o SESSION_SECRET como pepper.
 * Consequencia: um dump do banco NAO permite sequestrar sessoes, do mesmo modo
 * que nao permite descobrir senhas. SHA-256 puro basta aqui (diferente de
 * senha, que exige Argon2) porque o token tem 256 bits de entropia real - nao
 * ha dicionario nem forca bruta viavel contra ele.
 */
function hashToken(token: string): string {
  const pepper = process.env.SESSION_SECRET ?? "";
  return createHash("sha256").update(`${token}${pepper}`).digest("hex");
}

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  roleSlug: string;
  roleName: string;
  departmentName: string | null;
  permissions: Set<Permission>;
};

/**
 * Cria a sessao e grava o cookie.
 * Retorna o token em claro apenas para quem chamou - ele nunca volta a existir.
 */
export async function createSession(
  userId: string,
  meta: { ip?: string | null; userAgent?: string | null } = {},
): Promise<void> {
  const token = randomBytes(TOKEN_BYTES).toString("base64url");
  const expiresAt = new Date(Date.now() + ttlHours() * 3600 * 1000);

  await db.session.create({
    data: {
      tokenHash: hashToken(token),
      userId,
      expiresAt,
      ipAddress: meta.ip ?? null,
      userAgent: meta.userAgent?.slice(0, 255) ?? null,
    },
  });

  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true, // inacessivel a JavaScript: neutraliza roubo via XSS
    sameSite: "lax", // bloqueia CSRF vindo de outro site
    secure: secureCookie(),
    path: "/",
    expires: expiresAt,
  });
}

/**
 * O cookie deve exigir HTTPS?
 *
 * `secure: true` faz o navegador enviar o cookie SOMENTE por HTTPS. Este
 * portal roda em HTTP na rede interna, entao amarrar isso a NODE_ENV
 * quebrava o login por completo em producao: o cookie era gravado, o
 * navegador nunca o devolvia, e o usuario voltava eternamente para a tela de
 * login (loop de redirecionamento).
 *
 * Fica explicito em variavel de ambiente: no dia em que houver certificado,
 * basta trocar SESSION_COOKIE_SECURE para "true" - sem mexer em codigo.
 */
function secureCookie(): boolean {
  return process.env.SESSION_COOKIE_SECURE === "true";
}

/**
 * Le a sessao atual. Retorna null quando nao ha sessao valida.
 *
 * Envolvido em `cache` do React: varios Server Components na mesma pagina
 * chamam getSession, e sem isso cada um faria sua propria consulta ao banco.
 */
export const getSession = cache(async (): Promise<SessionUser | null> => {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const session = await db.session.findUnique({
    where: { tokenHash: hashToken(token) },
    select: {
      id: true,
      expiresAt: true,
      revokedAt: true,
      lastSeenAt: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          avatarUrl: true,
          isActive: true,
          department: { select: { name: true } },
          role: {
            select: {
              slug: true,
              name: true,
              permissions: { select: { permission: { select: { slug: true } } } },
            },
          },
        },
      },
    },
  });

  if (!session) return null;
  if (session.revokedAt) return null;
  if (session.expiresAt.getTime() < Date.now()) return null;
  // Usuario desativado perde o acesso imediatamente, mesmo com sessao valida.
  if (!session.user.isActive) return null;

  if (Date.now() - session.lastSeenAt.getTime() > TOUCH_INTERVAL_MS) {
    await db.session.update({
      where: { id: session.id },
      data: { lastSeenAt: new Date() },
    });
  }

  const { user } = session;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    avatarUrl: user.avatarUrl,
    roleSlug: user.role.slug,
    roleName: user.role.name,
    departmentName: user.department?.name ?? null,
    permissions: new Set(
      user.role.permissions.map((p) => p.permission.slug as Permission),
    ),
  };
});

/** Encerra a sessao atual (logout). */
export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;

  if (token) {
    await db.session
      .updateMany({
        where: { tokenHash: hashToken(token) },
        data: { revokedAt: new Date() },
      })
      .catch(() => {
        // Sessao ja inexistente: o logout deve ter sucesso do mesmo jeito.
      });
  }

  store.delete(COOKIE_NAME);
}

/** Revoga todas as sessoes de um usuario (troca de senha, desligamento). */
export async function revokeAllSessions(userId: string): Promise<number> {
  const { count } = await db.session.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return count;
}

/** Remove sessoes expiradas ha mais de 30 dias. */
export async function pruneExpiredSessions(): Promise<number> {
  const cutoff = new Date(Date.now() - 30 * 24 * 3600 * 1000);
  const { count } = await db.session.deleteMany({
    where: { expiresAt: { lt: cutoff } },
  });
  return count;
}

/**
 * Comparacao em tempo constante, para conferencias que envolvam segredo curto
 * (ex.: token de reset de senha na Fase 3). Comparar com === vaza, pelo tempo
 * de resposta, quantos caracteres iniciais estavam corretos.
 */
export function safeEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export const SESSION_COOKIE_NAME = COOKIE_NAME;
