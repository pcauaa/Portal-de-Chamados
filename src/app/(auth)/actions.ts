"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { isAppError } from "@/lib/http/errors";
import { logger } from "@/lib/logger";
import { destroySession } from "@/lib/auth/session";
import { isSafeRedirect } from "@/lib/auth/safe-redirect";
import { login } from "@/modules/auth/service";
import { loginSchema } from "@/modules/auth/schemas";

export type FormState = { error: string | null };

async function requestContext() {
  const headerList = await headers();
  return {
    ip: headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    userAgent: headerList.get("user-agent"),
  };
}

export async function loginAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados invalidos." };
  }

  try {
    await login(parsed.data, await requestContext());
  } catch (error) {
    if (isAppError(error)) return { error: error.message };
    logger.error({ err: error }, "falha inesperada no login");
    return { error: "Nao foi possivel entrar. Tente novamente." };
  }

  // O redirect fica FORA do try: o Next sinaliza redirecionamento lancando uma
  // excecao, que seria capturada pelo catch acima e viraria "erro no login".
  const destino = String(formData.get("redirect") ?? "") || "/dashboard";
  redirect(isSafeRedirect(destino) ? destino : "/dashboard");
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/login");
}

