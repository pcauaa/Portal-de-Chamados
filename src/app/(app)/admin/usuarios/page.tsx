import type { Metadata } from "next";
import { requirePage } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/config/permissions";
import { listUsersForAdmin, listRoles } from "@/modules/users/queries";
import { listActiveDepartments } from "@/modules/catalog/queries";
import { UsersManager } from "./users-manager";

export const metadata: Metadata = { title: "Usuarios" };

export default async function AdminUsersPage() {
  const admin = await requirePage({ permission: PERMISSIONS.USER_MANAGE });

  const [users, roles, departments] = await Promise.all([
    listUsersForAdmin(),
    listRoles(),
    listActiveDepartments(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Usuarios</h1>
        <p className="text-sm text-muted-foreground">
          Contas de acesso ao portal. Usuarios sao desativados, nunca excluidos -
          assim o historico de chamados continua intacto.
        </p>
      </div>

      <UsersManager
        currentUserId={admin.id}
        users={users.map((u) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          phone: u.phone,
          isActive: u.isActive,
          isLocked: u.lockedUntil !== null && u.lockedUntil.getTime() > Date.now(),
          lastLoginAt: u.lastLoginAt ? u.lastLoginAt.toISOString() : null,
          roleId: u.role.id,
          roleName: u.role.name,
          departmentId: u.department?.id ?? null,
          departmentName: u.department?.name ?? null,
          ticketCount: u._count.requestedTickets,
        }))}
        roles={roles}
        departments={departments.map((d) => ({ id: d.id, name: d.name }))}
      />
    </div>
  );
}
