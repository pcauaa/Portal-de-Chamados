import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { AppError, notFound } from "@/lib/http/errors";
import { assertCan } from "@/lib/auth/guards";
import type { SessionUser } from "@/lib/auth/session";
import { PERMISSIONS } from "@/config/permissions";
import { logger } from "@/lib/logger";
import type { CategoryInput, DepartmentInput } from "./schemas";

/**
 * Catalogo: categorias e setores.
 *
 * Regra que atravessa o modulo: nada aqui e excluido de verdade.
 *
 * Excluir uma categoria com 200 chamados historicos exigiria apagar os
 * chamados junto (a FK e Restrict, de proposito) ou deixaria o relatorio do
 * ano inteiro quebrado. Desativar some do formulario de abertura e preserva
 * todo o historico - que e o que o usuario realmente quer quando clica em
 * "excluir uma categoria que nao usamos mais".
 */

function slugify(value: string): string {
  return value
    .normalize("NFD")
    // \p{Diacritic} remove os acentos que o NFD acabou de separar das letras.
    // Preferido a uma faixa de caracteres literais, que ficam invisiveis no
    // editor e se perdem em copia/cola entre codificacoes.
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

async function audit(
  actorId: string,
  eventType: string,
  targetType: string,
  targetId: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        actorId,
        eventType,
        targetType,
        targetId,
        metadata: (metadata ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
  } catch (error) {
    logger.error({ err: error, eventType }, "falha ao gravar auditoria de catalogo");
  }
}

// --- Categorias ------------------------------------------------------------

export async function createCategory(
  admin: SessionUser,
  input: CategoryInput,
): Promise<string> {
  assertCan(admin, PERMISSIONS.CATEGORY_MANAGE);

  const slug = slugify(input.name);
  const existing = await db.category.findFirst({
    where: { OR: [{ slug }, { name: input.name }] },
  });
  if (existing) {
    throw new AppError("CONFLICT", "Ja existe uma categoria com esse nome.");
  }

  const last = await db.category.findFirst({ orderBy: { sortOrder: "desc" } });

  const category = await db.category.create({
    data: {
      name: input.name,
      slug,
      description: input.description || null,
      icon: input.icon || "circle-help",
      defaultPriority: input.defaultPriority,
      slaHours: input.slaHours ?? null,
      sortOrder: (last?.sortOrder ?? 0) + 1,
    },
  });

  await audit(admin.id, "category.created", "category", category.id, {
    nome: input.name,
  });
  return category.id;
}

export async function updateCategory(
  admin: SessionUser,
  categoryId: string,
  input: CategoryInput,
): Promise<void> {
  assertCan(admin, PERMISSIONS.CATEGORY_MANAGE);

  const category = await db.category.findUnique({ where: { id: categoryId } });
  if (!category) throw notFound("Categoria");

  const duplicate = await db.category.findFirst({
    where: { name: input.name, id: { not: categoryId } },
  });
  if (duplicate) {
    throw new AppError("CONFLICT", "Ja existe outra categoria com esse nome.");
  }

  await db.category.update({
    where: { id: categoryId },
    data: {
      name: input.name,
      description: input.description || null,
      icon: input.icon || "circle-help",
      defaultPriority: input.defaultPriority,
      slaHours: input.slaHours ?? null,
      // O slug NAO muda ao renomear: ele aparece em URLs e atalhos (o QR Code
      // colado na impressora, por exemplo). Renomear a categoria nao pode
      // quebrar um link que ja esta na parede.
    },
  });

  await audit(admin.id, "category.updated", "category", categoryId, {
    nome: input.name,
  });
}

export async function setCategoryActive(
  admin: SessionUser,
  categoryId: string,
  isActive: boolean,
): Promise<void> {
  assertCan(admin, PERMISSIONS.CATEGORY_MANAGE);

  const category = await db.category.findUnique({
    where: { id: categoryId },
    select: { id: true, _count: { select: { tickets: true } } },
  });
  if (!category) throw notFound("Categoria");

  // Impede desativar a ultima categoria ativa: sem nenhuma, o formulario de
  // abertura fica sem opcao e ninguem consegue abrir chamado.
  if (!isActive) {
    const ativas = await db.category.count({ where: { isActive: true } });
    if (ativas <= 1) {
      throw new AppError(
        "VALIDATION_ERROR",
        "E preciso manter ao menos uma categoria ativa.",
      );
    }
  }

  await db.category.update({ where: { id: categoryId }, data: { isActive } });

  await audit(
    admin.id,
    isActive ? "category.activated" : "category.deactivated",
    "category",
    categoryId,
    { chamadosVinculados: category._count.tickets },
  );
}

// --- Setores ---------------------------------------------------------------

export async function createDepartment(
  admin: SessionUser,
  input: DepartmentInput,
): Promise<string> {
  assertCan(admin, PERMISSIONS.DEPARTMENT_MANAGE);

  const existing = await db.department.findUnique({ where: { name: input.name } });
  if (existing) {
    throw new AppError("CONFLICT", "Ja existe um setor com esse nome.");
  }

  const department = await db.department.create({ data: { name: input.name } });
  await audit(admin.id, "department.created", "department", department.id, {
    nome: input.name,
  });
  return department.id;
}

export async function updateDepartment(
  admin: SessionUser,
  departmentId: string,
  input: DepartmentInput,
): Promise<void> {
  assertCan(admin, PERMISSIONS.DEPARTMENT_MANAGE);

  const duplicate = await db.department.findFirst({
    where: { name: input.name, id: { not: departmentId } },
  });
  if (duplicate) throw new AppError("CONFLICT", "Ja existe outro setor com esse nome.");

  await db.department.update({
    where: { id: departmentId },
    data: { name: input.name },
  });
  await audit(admin.id, "department.updated", "department", departmentId);
}

export async function setDepartmentActive(
  admin: SessionUser,
  departmentId: string,
  isActive: boolean,
): Promise<void> {
  assertCan(admin, PERMISSIONS.DEPARTMENT_MANAGE);

  await db.department.update({ where: { id: departmentId }, data: { isActive } });
  await audit(
    admin.id,
    isActive ? "department.activated" : "department.deactivated",
    "department",
    departmentId,
  );
}
