import {
  Building2,
  ChartColumn,
  CirclePlus,
  Inbox,
  LayoutDashboard,
  ScrollText,
  Tags,
  Ticket,
  Users,
  CircleHelp,
  type LucideIcon,
} from "lucide-react";

/**
 * Mapa explicito de icones da navegacao.
 *
 * Poderiamos importar dinamicamente pelo nome, mas isso impede o tree-shaking
 * e traz o pacote inteiro de icones (mais de 1500) para o bundle. Uma lista
 * curta e explicita custa uma linha por icone novo e mantem o carregamento leve
 * - relevante porque o colaborador acessa o portal do celular quando o
 * computador dele parou de funcionar.
 */
const ICONS: Record<string, LucideIcon> = {
  "layout-dashboard": LayoutDashboard,
  ticket: Ticket,
  "circle-plus": CirclePlus,
  inbox: Inbox,
  "chart-column": ChartColumn,
  users: Users,
  tags: Tags,
  "building-2": Building2,
  "scroll-text": ScrollText,
};

export function NavIcon({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  const Icon = ICONS[name] ?? CircleHelp;
  return <Icon className={className} aria-hidden />;
}
