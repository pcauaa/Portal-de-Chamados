/**
 * Catalogo de permissoes do sistema.
 *
 * Este arquivo e a fonte da verdade: o seed popula as tabelas `permissions` e
 * `role_permissions` a partir daqui, e a checagem em runtime usa os mesmos
 * slugs. Manter as permissoes em tabela (e nao como `if (role === 'admin')`
 * espalhado pelo codigo) e o que permite criar um perfil novo - "Gestor", que
 * so le dashboards - com um INSERT em vez de um deploy.
 */

export const PERMISSIONS = {
  // --- Chamados ---
  TICKET_CREATE: "ticket.create",
  TICKET_VIEW_OWN: "ticket.view_own",
  /** Ver chamados de todos os colaboradores (fila da TI). */
  TICKET_VIEW_ALL: "ticket.view_all",
  /** Editar titulo/descricao do proprio chamado enquanto ninguem assumiu. */
  TICKET_EDIT_OWN_DRAFT: "ticket.edit_own_draft",
  /** Assumir um chamado para si. */
  TICKET_ASSIGN: "ticket.assign",
  /** Atribuir um chamado a outro tecnico. */
  TICKET_ASSIGN_OTHERS: "ticket.assign_others",
  /** Transicoes de status privativas da TI. */
  TICKET_CHANGE_STATUS: "ticket.change_status",
  TICKET_CHANGE_PRIORITY: "ticket.change_priority",
  TICKET_CHANGE_CATEGORY: "ticket.change_category",
  TICKET_CANCEL_OWN: "ticket.cancel_own",
  TICKET_REOPEN: "ticket.reopen",

  // --- Interacoes ---
  COMMENT_CREATE: "comment.create",
  /** Escrever e LER notas internas. Sem ela, o comentario interno nunca sai do servidor. */
  COMMENT_INTERNAL: "comment.internal",
  ATTACHMENT_UPLOAD: "attachment.upload",
  /** Baixar anexo de qualquer chamado. Sem ela, so dos proprios. */
  ATTACHMENT_DOWNLOAD_ALL: "attachment.download_all",

  // --- Visao gerencial ---
  DASHBOARD_PERSONAL: "dashboard.personal",
  DASHBOARD_IT: "dashboard.it",
  REPORT_EXPORT: "report.export",

  // --- Administracao ---
  CATEGORY_MANAGE: "category.manage",
  DEPARTMENT_MANAGE: "department.manage",
  USER_MANAGE: "user.manage",
  AUDIT_VIEW: "audit.view",
  SETTINGS_MANAGE: "settings.manage",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const PERMISSION_DESCRIPTIONS: Record<Permission, string> = {
  [PERMISSIONS.TICKET_CREATE]: "Abrir chamados",
  [PERMISSIONS.TICKET_VIEW_OWN]: "Ver os proprios chamados",
  [PERMISSIONS.TICKET_VIEW_ALL]: "Ver os chamados de todos os colaboradores",
  [PERMISSIONS.TICKET_EDIT_OWN_DRAFT]:
    "Editar o proprio chamado enquanto ninguem assumiu",
  [PERMISSIONS.TICKET_ASSIGN]: "Assumir chamados",
  [PERMISSIONS.TICKET_ASSIGN_OTHERS]: "Atribuir chamados a outro tecnico",
  [PERMISSIONS.TICKET_CHANGE_STATUS]: "Alterar o status de um chamado",
  [PERMISSIONS.TICKET_CHANGE_PRIORITY]: "Alterar a prioridade de um chamado",
  [PERMISSIONS.TICKET_CHANGE_CATEGORY]: "Alterar a categoria de um chamado",
  [PERMISSIONS.TICKET_CANCEL_OWN]: "Cancelar o proprio chamado",
  [PERMISSIONS.TICKET_REOPEN]: "Reabrir um chamado",
  [PERMISSIONS.COMMENT_CREATE]: "Comentar em chamados",
  [PERMISSIONS.COMMENT_INTERNAL]: "Escrever e ler notas internas da TI",
  [PERMISSIONS.ATTACHMENT_UPLOAD]: "Anexar arquivos",
  [PERMISSIONS.ATTACHMENT_DOWNLOAD_ALL]:
    "Baixar anexos de qualquer chamado",
  [PERMISSIONS.DASHBOARD_PERSONAL]: "Ver o proprio painel",
  [PERMISSIONS.DASHBOARD_IT]: "Ver o painel gerencial da TI",
  [PERMISSIONS.REPORT_EXPORT]: "Exportar relatorios",
  [PERMISSIONS.CATEGORY_MANAGE]: "Gerenciar categorias",
  [PERMISSIONS.DEPARTMENT_MANAGE]: "Gerenciar setores",
  [PERMISSIONS.USER_MANAGE]: "Gerenciar usuarios",
  [PERMISSIONS.AUDIT_VIEW]: "Consultar o log de auditoria",
  [PERMISSIONS.SETTINGS_MANAGE]: "Alterar configuracoes do sistema",
};

export const ROLES = {
  COLABORADOR: "colaborador",
  TECNICO: "tecnico",
  ADMIN: "admin",
} as const;

export type RoleSlug = (typeof ROLES)[keyof typeof ROLES];

export const ROLE_NAMES: Record<RoleSlug, string> = {
  [ROLES.COLABORADOR]: "Colaborador",
  [ROLES.TECNICO]: "Tecnico de TI",
  [ROLES.ADMIN]: "Administrador",
};

/**
 * O que cada perfil pode fazer.
 *
 * Nota sobre o colaborador e o status: ele NAO recebe `ticket.change_status`.
 * As duas transicoes que ele pode disparar - confirmar um chamado RESOLVIDO ou
 * devolve-lo para EM_ANDAMENTO - sao autorizadas pela maquina de estados, que
 * verifica se ele e o solicitante. Dar a permissao generica abriria a porta
 * para ele alterar o status de qualquer forma.
 *
 * Nota sobre prioridade: propositalmente ausente do colaborador. Se o usuario
 * puder escolher, em duas semanas todo chamado e URGENTE e o campo perde
 * qualquer valor de triagem.
 */
const COLABORADOR_PERMISSIONS: Permission[] = [
  PERMISSIONS.TICKET_CREATE,
  PERMISSIONS.TICKET_VIEW_OWN,
  PERMISSIONS.TICKET_EDIT_OWN_DRAFT,
  PERMISSIONS.TICKET_CANCEL_OWN,
  PERMISSIONS.TICKET_REOPEN,
  PERMISSIONS.COMMENT_CREATE,
  PERMISSIONS.ATTACHMENT_UPLOAD,
  PERMISSIONS.DASHBOARD_PERSONAL,
];

const TECNICO_PERMISSIONS: Permission[] = [
  ...COLABORADOR_PERMISSIONS,
  PERMISSIONS.TICKET_VIEW_ALL,
  PERMISSIONS.TICKET_ASSIGN,
  PERMISSIONS.TICKET_CHANGE_STATUS,
  PERMISSIONS.TICKET_CHANGE_PRIORITY,
  PERMISSIONS.TICKET_CHANGE_CATEGORY,
  PERMISSIONS.COMMENT_INTERNAL,
  PERMISSIONS.ATTACHMENT_DOWNLOAD_ALL,
  PERMISSIONS.DASHBOARD_IT,
  PERMISSIONS.REPORT_EXPORT,
];

const ADMIN_PERMISSIONS: Permission[] = [
  ...TECNICO_PERMISSIONS,
  PERMISSIONS.TICKET_ASSIGN_OTHERS,
  PERMISSIONS.CATEGORY_MANAGE,
  PERMISSIONS.DEPARTMENT_MANAGE,
  PERMISSIONS.USER_MANAGE,
  PERMISSIONS.AUDIT_VIEW,
  PERMISSIONS.SETTINGS_MANAGE,
];

export const ROLE_PERMISSIONS: Record<RoleSlug, Permission[]> = {
  [ROLES.COLABORADOR]: COLABORADOR_PERMISSIONS,
  [ROLES.TECNICO]: TECNICO_PERMISSIONS,
  [ROLES.ADMIN]: ADMIN_PERMISSIONS,
};

export const ALL_PERMISSIONS = Object.values(PERMISSIONS);
