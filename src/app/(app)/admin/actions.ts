"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth/guards";
import { isAppError } from "@/lib/http/errors";
import { logger } from "@/lib/logger";
import {
  createUserSchema,
  updateUserSchema,
  setPasswordSchema,
} from "@/modules/users/schemas";
import {
  createUser,
  updateUser,
  setUserActive,
  resetPassword,
  setUserPassword,
  unlockUser,
  deleteUser,
} from "@/modules/users/service";
import { categorySchema, departmentSchema } from "@/modules/catalog/schemas";
import {
  createCategory,
  updateCategory,
  setCategoryActive,
  createDepartment,
  updateDepartment,
  setDepartmentActive,
} from "@/modules/catalog/service";

/**
 * `password` carrega a senha temporaria gerada, para o admin repassar ao
 * colaborador. Ela existe apenas nesta resposta - nunca e persistida em claro
 * nem registrada em log.
 */
export type AdminState = {
  error: string | null;
  ok?: boolean;
  password?: string;
  passwordFor?: string;
  /** true = sorteada pelo sistema, false = digitada pelo admin. */
  passwordWasGenerated?: boolean;
  /** Confirmacao para o admin apos uma acao destrutiva. */
  notice?: string;
};

async function run(
  path: string,
  fn: (user: Awaited<ReturnType<typeof requireSession>>) => Promise<AdminState>,
): Promise<AdminState> {
  let result: AdminState;
  try {
    const user = await requireSession();
    result = await fn(user);
  } catch (error) {
    if (isAppError(error)) return { error: error.message };
    logger.error({ err: error, path }, "falha em acao administrativa");
    return { error: "Nao foi possivel concluir a acao." };
  }
  revalidatePath(path);
  return result;
}

// --- Usuarios --------------------------------------------------------------

export async function createUserAction(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const parsed = createUserSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    roleId: formData.get("roleId"),
    departmentId: formData.get("departmentId") || null,
    phone: formData.get("phone") ?? "",
    password: formData.get("password") ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados invalidos." };
  }

  return run("/admin/usuarios", async (admin) => {
    const created = await createUser(admin, parsed.data);
    return {
      error: null,
      ok: true,
      password: created.password,
      passwordFor: parsed.data.email,
      passwordWasGenerated: created.wasGenerated,
    };
  });
}

export async function updateUserAction(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const userId = String(formData.get("userId"));
  const parsed = updateUserSchema.safeParse({
    name: formData.get("name"),
    roleId: formData.get("roleId"),
    departmentId: formData.get("departmentId") || null,
    phone: formData.get("phone") ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados invalidos." };
  }

  return run("/admin/usuarios", async (admin) => {
    await updateUser(admin, userId, parsed.data);
    return { error: null, ok: true };
  });
}

export async function toggleUserAction(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const userId = String(formData.get("userId"));
  const isActive = formData.get("isActive") === "true";

  return run("/admin/usuarios", async (admin) => {
    await setUserActive(admin, userId, isActive);
    return { error: null, ok: true };
  });
}

export async function resetPasswordAction(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const userId = String(formData.get("userId"));
  const email = String(formData.get("email") ?? "");

  return run("/admin/usuarios", async (admin) => {
    const senha = await resetPassword(admin, userId);
    return {
      error: null,
      ok: true,
      password: senha,
      passwordFor: email,
      passwordWasGenerated: true,
    };
  });
}

/** Define uma senha ESCOLHIDA pelo admin, em vez de sortear. */
export async function setPasswordAction(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const userId = String(formData.get("userId"));
  const email = String(formData.get("email") ?? "");

  const parsed = setPasswordSchema.safeParse({
    password: formData.get("password") ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados invalidos." };
  }
  const senha = parsed.data.password?.trim() ?? "";
  if (!senha) {
    return { error: "Informe a nova senha." };
  }

  return run("/admin/usuarios", async (admin) => {
    await setUserPassword(admin, userId, senha);
    return {
      error: null,
      ok: true,
      password: senha,
      passwordFor: email,
      passwordWasGenerated: false,
    };
  });
}

export async function unlockUserAction(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const userId = String(formData.get("userId"));

  return run("/admin/usuarios", async (admin) => {
    await unlockUser(admin, userId);
    return { error: null, ok: true };
  });
}

/**
 * Exclusao definitiva. Exige confirmacao explicita vinda do formulario - a
 * tela so envia `confirmar=sim` depois que o admin confirmou, ciente de
 * quantos chamados vao junto.
 */
export async function deleteUserAction(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const userId = String(formData.get("userId"));

  if (formData.get("confirmar") !== "sim") {
    return { error: "Exclusao nao confirmada." };
  }

  return run("/admin/usuarios", async (admin) => {
    const r = await deleteUser(admin, userId);
    const detalhe =
      r.chamadosRemovidos > 0
        ? ` ${r.chamadosRemovidos} chamado(s) foram removidos junto.`
        : "";
    return { error: null, ok: true, notice: `Usuario excluido.${detalhe}` };
  });
}

// --- Categorias ------------------------------------------------------------

export async function saveCategoryAction(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const categoryId = String(formData.get("categoryId") ?? "");
  const slaRaw = String(formData.get("slaHours") ?? "").trim();

  const parsed = categorySchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") ?? "",
    icon: formData.get("icon") || "circle-help",
    defaultPriority: formData.get("defaultPriority"),
    slaHours: slaRaw === "" ? null : slaRaw,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados invalidos." };
  }

  return run("/admin/categorias", async (admin) => {
    if (categoryId) {
      await updateCategory(admin, categoryId, parsed.data);
    } else {
      await createCategory(admin, parsed.data);
    }
    return { error: null, ok: true };
  });
}

export async function toggleCategoryAction(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const categoryId = String(formData.get("categoryId"));
  const isActive = formData.get("isActive") === "true";

  return run("/admin/categorias", async (admin) => {
    await setCategoryActive(admin, categoryId, isActive);
    return { error: null, ok: true };
  });
}

// --- Setores ---------------------------------------------------------------

export async function saveDepartmentAction(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const departmentId = String(formData.get("departmentId") ?? "");
  const parsed = departmentSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados invalidos." };
  }

  return run("/admin/setores", async (admin) => {
    if (departmentId) {
      await updateDepartment(admin, departmentId, parsed.data);
    } else {
      await createDepartment(admin, parsed.data);
    }
    return { error: null, ok: true };
  });
}

export async function toggleDepartmentAction(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const departmentId = String(formData.get("departmentId"));
  const isActive = formData.get("isActive") === "true";

  return run("/admin/setores", async (admin) => {
    await setDepartmentActive(admin, departmentId, isActive);
    return { error: null, ok: true };
  });
}
