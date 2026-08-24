"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { NavSection } from "@/config/navigation";
import { NavIcon } from "./nav-icon";

/**
 * Lista de links da sidebar.
 *
 * As secoes ja chegam filtradas pelo servidor (visibleNavigation): este
 * componente nunca recebe um item que o usuario nao pode ver, entao nao ha
 * risco de vazar a existencia de telas administrativas pelo HTML.
 */
export function SidebarNav({
  sections,
  onNavigate,
}: {
  sections: NavSection[];
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-6" aria-label="Menu principal">
      {sections.map((section) => (
        <div key={section.title ?? "principal"} className="flex flex-col gap-1">
          {section.title ? (
            <h2 className="px-3 pb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {section.title}
            </h2>
          ) : null}

          {section.items.map((item) => {
            // "Abrir chamado" (/chamados/novo) nao pode marcar "Meus chamados"
            // como ativo, por isso o prefixo exige a barra final.
            const active = item.matchPrefix
              ? pathname === item.href || pathname.startsWith(`${item.href}/`)
              : pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <NavIcon name={item.icon} className="size-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
