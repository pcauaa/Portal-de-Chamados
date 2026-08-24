"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { NavSection } from "@/config/navigation";
import { SidebarNav } from "./sidebar-nav";

/**
 * Menu em gaveta para telas estreitas.
 *
 * Vale lembrar por que o mobile importa aqui: o caso de uso mais comum do
 * portal e justamente "meu computador nao liga". Se o sistema so funcionasse
 * bem no desktop, o colaborador voltaria para o WhatsApp exatamente na hora em
 * que mais precisa abrir um chamado.
 */
export function MobileNav({ sections }: { sections: NavSection[] }) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      {/* Base UI usa `render` para delegar a renderizacao a outro componente -
          equivalente ao `asChild` do Radix. */}
      <SheetTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            aria-label="Abrir menu"
          />
        }
      >
        <Menu className="size-5" aria-hidden />
      </SheetTrigger>

      <SheetContent side="left" className="w-72 p-0">
        <SheetHeader className="border-b px-4 py-4">
          <SheetTitle
            render={
              <Link
                href="/dashboard"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 text-base"
              />
            }
          >
            <Image
              src="/logo.png"
              alt="Portal de Chamados"
              width={256}
              height={256}
              className="h-8 w-auto dark:invert"
            />
            Portal de Chamados
          </SheetTitle>
        </SheetHeader>

        <div className="px-3 py-4">
          <SidebarNav sections={sections} onNavigate={() => setOpen(false)} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
