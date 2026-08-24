import "server-only";
import { db } from "@/lib/db";

/** Categorias visiveis no formulario de abertura e nos filtros da fila. */
export async function listActiveCategories() {
  return db.category.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
  });
}

/** Todas as categorias, inclusive desativadas, com uso real - tela de admin. */
export async function listCategoriesForAdmin() {
  return db.category.findMany({
    include: { _count: { select: { tickets: true } } },
    orderBy: [{ isActive: "desc" }, { sortOrder: "asc" }],
  });
}

export type AdminCategory = Awaited<
  ReturnType<typeof listCategoriesForAdmin>
>[number];

export async function listActiveDepartments() {
  return db.department.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
  });
}

export async function listDepartmentsForAdmin() {
  return db.department.findMany({
    include: { _count: { select: { users: true, tickets: true } } },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });
}

export type AdminDepartment = Awaited<
  ReturnType<typeof listDepartmentsForAdmin>
>[number];
