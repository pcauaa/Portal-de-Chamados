import { PERMISSIONS, type Permission } from "./permissions";

/**
 * Itens da sidebar.
 *
 * Cada item declara a permissao que o torna visivel. Esconder o link e apenas
 * conveniencia visual - a barreira real esta no servidor, em requirePage. Um
 * usuario que digitar /admin/usuarios na URL e barrado la, nao aqui.
 */

export type NavItem = {
  label: string;
  href: string;
  /** Nome do icone lucide-react. */
  icon: string;
  /** Sem permissao declarada = visivel para qualquer usuario autenticado. */
  permission?: Permission;
  /** Marca ativo tambem nas sub-rotas (ex.: /chamados/000123). */
  matchPrefix?: boolean;
};

export type NavSection = {
  title: string | null;
  items: NavItem[];
};

export const NAVIGATION: NavSection[] = [
  {
    title: null,
    items: [
      {
        label: "Painel",
        href: "/dashboard",
        icon: "layout-dashboard",
      },
      {
        label: "Meus chamados",
        href: "/chamados",
        icon: "ticket",
        matchPrefix: true,
      },
      {
        label: "Abrir chamado",
        href: "/chamados/novo",
        icon: "circle-plus",
        permission: PERMISSIONS.TICKET_CREATE,
      },
    ],
  },
  {
    title: "Suporte de TI",
    items: [
      {
        label: "Fila de atendimento",
        href: "/ti/fila",
        icon: "inbox",
        permission: PERMISSIONS.TICKET_VIEW_ALL,
        matchPrefix: true,
      },
      {
        label: "Indicadores",
        href: "/ti/dashboard",
        icon: "chart-column",
        permission: PERMISSIONS.DASHBOARD_IT,
      },
    ],
  },
  {
    title: "Administracao",
    items: [
      {
        label: "Usuarios",
        href: "/admin/usuarios",
        icon: "users",
        permission: PERMISSIONS.USER_MANAGE,
        matchPrefix: true,
      },
      {
        label: "Categorias",
        href: "/admin/categorias",
        icon: "tags",
        permission: PERMISSIONS.CATEGORY_MANAGE,
      },
      {
        label: "Setores",
        href: "/admin/setores",
        icon: "building-2",
        permission: PERMISSIONS.DEPARTMENT_MANAGE,
      },
      {
        label: "Auditoria",
        href: "/admin/auditoria",
        icon: "scroll-text",
        permission: PERMISSIONS.AUDIT_VIEW,
      },
    ],
  },
];

/** Remove itens e secoes que o usuario nao pode ver. */
export function visibleNavigation(permissions: Set<Permission>): NavSection[] {
  return NAVIGATION.map((section) => ({
    ...section,
    items: section.items.filter(
      (item) => !item.permission || permissions.has(item.permission),
    ),
  })).filter((section) => section.items.length > 0);
}
