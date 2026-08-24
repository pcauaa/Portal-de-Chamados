import type { Metadata } from "next";
import { requirePage } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/config/permissions";
import { listCategoriesForAdmin } from "@/modules/catalog/queries";
import { CategoriesManager } from "./categories-manager";

export const metadata: Metadata = { title: "Categorias" };

export default async function AdminCategoriesPage() {
  await requirePage({ permission: PERMISSIONS.CATEGORY_MANAGE });
  const categories = await listCategoriesForAdmin();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Categorias</h1>
        <p className="text-sm text-muted-foreground">
          O que aparece no formulario de abertura. A prioridade padrao de cada
          categoria e a que o chamado recebe ao ser criado - o colaborador nao
          escolhe prioridade.
        </p>
      </div>

      <CategoriesManager
        categories={categories.map((c) => ({
          id: c.id,
          name: c.name,
          description: c.description,
          icon: c.icon,
          defaultPriority: c.defaultPriority,
          slaHours: c.slaHours,
          isActive: c.isActive,
          ticketCount: c._count.tickets,
        }))}
      />
    </div>
  );
}
