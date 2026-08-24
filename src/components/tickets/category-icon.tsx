import {
  CircleHelp,
  Database,
  HardDrive,
  KeyRound,
  Mail,
  Monitor,
  Network,
  Phone,
  Printer,
  Wifi,
  type LucideIcon,
} from "lucide-react";

/**
 * Icones do catalogo de categorias (tabela `categories`, coluna `icon`).
 *
 * Mapa explicito, igual ao de nav-icon.tsx: evita importar o pacote de
 * icones inteiro (mais de 1500 icones) so para usar 10. Se uma categoria nova
 * precisar de um icone fora desta lista, a linha nova custa um import.
 */
const ICONS: Record<string, LucideIcon> = {
  monitor: Monitor,
  printer: Printer,
  wifi: Wifi,
  database: Database,
  mail: Mail,
  network: Network,
  phone: Phone,
  "hard-drive": HardDrive,
  "key-round": KeyRound,
  "circle-help": CircleHelp,
};

export function CategoryIcon({
  icon,
  className,
}: {
  icon: string;
  className?: string;
}) {
  const Icon = ICONS[icon] ?? CircleHelp;
  return <Icon className={className} aria-hidden />;
}
