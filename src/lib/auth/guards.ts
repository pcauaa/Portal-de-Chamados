import "server-only";
import { redirect } from "next/navigation";
import type { Permission } from "@/config/permissions";
import { forbidden, unauthenticated } from "@/lib/http/errors";
import { getSession, type SessionUser } from "./session";

/**
 * Autorizacao.
 *
 * TODA checagem passa por `can()`. Nao existe `if (user.role === "admin")`
 * espalhado pelas telas - e isso que permite criar um perfil novo alterando
 * dados, e nao codigo.
 *
 * A regra que sustenta a seguranca: esconder um botao na interface e
 * conveniencia visual; a barreira real e sempre no servidor, aqui.
 */

export function can(user: SessionUser, permission: Permission): boolean {
  return user.permissions.has(permission);
}

export function canAny(user: SessionUser, permissions: Permission[]): boolean {
  return permissions.some((p) => user.permissions.has(p));
}

/** Lanca AppError 403 se faltar a permissao. Uso em services e rotas de API. */
export function assertCan(user: SessionUser, permission: Permission): void {
  if (!can(user, permission)) {
    throw forbidden();
  }
}

/**
 * Exige sessao em rota de API. Lanca 401 quando nao ha.
 * Em Server Component use `requirePage`, que redireciona em vez de lancar.
 */
export async function requireSession(): Promise<SessionUser> {
  const user = await getSession();
  if (!user) throw unauthenticated();
  return user;
}

/** Exige sessao E permissao, em uma chamada. */
export async function requirePermission(
  permission: Permission,
): Promise<SessionUser> {
  const user = await requireSession();
  assertCan(user, permission);
  return user;
}

/** Versao para paginas (Server Components): redireciona em vez de lancar erro. */
export async function requirePage(options?: {
  permission?: Permission;
}): Promise<SessionUser> {
  const user = await getSession();

  if (!user) redirect("/login");

  if (options?.permission && !can(user, options.permission)) {
    redirect("/dashboard");
  }

  return user;
}
