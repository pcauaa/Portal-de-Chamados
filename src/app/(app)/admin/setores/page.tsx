import type { Metadata } from "next";
import { requirePage } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/config/permissions";
import { listDepartmentsForAdmin } from "@/modules/catalog/queries";
import { DepartmentsManager } from "./departments-manager";

export const metadata: Metadata = { title: "Setores" };

export default async function AdminDepartmentsPage() {
  await requirePage({ permission: PERMISSIONS.DEPARTMENT_MANAGE });
  const departments = await listDepartmentsForAdmin();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Setores</h1>
        <p className="text-sm text-muted-foreground">
          O setor do colaborador e gravado no chamado no momento da abertura.
          Se ele mudar de setor depois, os relatorios antigos continuam corretos.
        </p>
      </div>

      <DepartmentsManager
        departments={departments.map((d) => ({
          id: d.id,
          name: d.name,
          isActive: d.isActive,
          userCount: d._count.users,
          ticketCount: d._count.tickets,
        }))}
      />
    </div>
  );
}
