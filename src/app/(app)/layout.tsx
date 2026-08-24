import Link from "next/link";
import Image from "next/image";
import { requirePage } from "@/lib/auth/guards";
import { visibleNavigation } from "@/config/navigation";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { MobileNav } from "@/components/layout/mobile-nav";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { UserMenu } from "@/components/layout/user-menu";

/**
 * Casco das telas autenticadas.
 *
 * requirePage aqui e a barreira REAL de acesso (o middleware apenas checa a
 * presenca do cookie, sem tocar no banco). Ele valida sessao, expiracao,
 * revogacao e usuario desativado.
 *
 * Como o layout roda em toda rota deste grupo, nenhuma pagina filha pode ser
 * alcancada sem passar por esta checagem, mesmo que alguem esqueca de proteger
 * a pagina individualmente.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requirePage();
  const sections = visibleNavigation(user.permissions);

  return (
    <div className="flex min-h-screen">
      {/* Sidebar fixa a partir de lg; abaixo disso vira a gaveta do MobileNav. */}
      <aside className="hidden w-64 shrink-0 border-r bg-card lg:flex lg:flex-col">
        <Link
          href="/dashboard"
          className="flex h-14 items-center gap-2.5 border-b px-5 transition-colors hover:bg-muted/60"
        >
          {/* dark:invert pelo mesmo motivo do login: arte preta sobre fundo
              transparente sumiria no tema escuro. */}
          <Image
            src="/logo.png"
            alt="Portal de Chamados"
            width={256}
            height={256}
            priority
            className="h-9 w-auto dark:invert"
          />
          <span className="text-sm font-semibold leading-tight tracking-tight">
            Portal de Chamados
          </span>
        </Link>

        <div className="flex-1 overflow-y-auto px-3 py-4">
          <SidebarNav sections={sections} />
        </div>

        <div className="border-t px-5 py-3 text-xs text-muted-foreground">
          {user.departmentName ?? "Sem setor"}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <MobileNav sections={sections} />

          <Link
            href="/dashboard"
            className="flex items-center gap-2 lg:hidden"
            aria-label="Ir para o painel"
          >
            <span className="text-sm font-semibold">Chamados</span>
          </Link>

          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
            <UserMenu
              name={user.name}
              email={user.email}
              roleName={user.roleName}
            />
          </div>
        </header>

        {/* min-w-0 impede que uma tabela larga estoure a largura da pagina e
            crie rolagem horizontal no body inteiro. */}
        <main className="min-w-0 flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
