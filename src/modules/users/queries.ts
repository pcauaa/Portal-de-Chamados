import "server-only";
import { db } from "@/lib/db";

/** Lista completa para a tela de administracao, com contagem de chamados. */
export async function listUsersForAdmin() {
  return db.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      isActive: true,
      lockedUntil: true,
      lastLoginAt: true,
      createdAt: true,
      role: { select: { id: true, slug: true, name: true } },
      department: { select: { id: true, name: true } },
      _count: { select: { requestedTickets: true, assignedTickets: true } },
    },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });
}

export type AdminUser = Awaited<ReturnType<typeof listUsersForAdmin>>[number];

export async function listRoles() {
  return db.role.findMany({
    select: { id: true, slug: true, name: true },
    orderBy: { slug: "asc" },
  });
}
