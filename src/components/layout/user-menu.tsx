"use client";

import { useRef } from "react";
import { LogOut } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { logoutAction } from "@/app/(auth)/actions";

export function UserMenu({
  name,
  email,
  roleName,
}: {
  name: string;
  email: string;
  roleName: string;
}) {
  const logoutFormRef = useRef<HTMLFormElement>(null);

  return (
    <>
      {/* Logout por POST (form + Server Action), nunca por link GET: um logout
          acionavel por GET pode ser disparado por qualquer imagem embutida em
          pagina externa, derrubando a sessao sem o usuario pedir.

          O formulario fica FORA do menu de proposito. Dentro do popup do Base
          UI ele quebrava o componente inteiro (Base UI error #31) - o menu nao
          renderizava, e por isso o "Sair" nunca aparecia para ser clicado. O
          item do menu apenas dispara requestSubmit() neste form escondido. */}
      <form ref={logoutFormRef} action={logoutAction} className="hidden" />

      <DropdownMenu>
      {/* Base UI usa `render` no lugar do `asChild` do Radix. */}
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            className="h-9 gap-2 px-2"
            aria-label="Menu do usuario"
          />
        }
      >
        <Avatar className="size-7">
          <AvatarFallback className="text-xs">{initials(name)}</AvatarFallback>
        </Avatar>
        <span className="hidden text-sm font-medium sm:inline">
          {firstName(name)}
        </span>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-60">
        {/* Cabecalho como <div> simples, e nao DropdownMenuLabel: aquele
            componente mapeia para Menu.GroupLabel do Base UI, que exige estar
            dentro de um Menu.Group. Fora dele, o Base UI lancava
            "MenuGroupContext is missing" e derrubava o menu INTEIRO - motivo
            real de o botao "Sair" nunca aparecer para ser clicado. */}
        <div className="flex flex-col gap-0.5 px-1.5 py-1">
          <span className="text-sm font-medium">{name}</span>
          <span className="text-xs text-muted-foreground">{email}</span>
          <span className="mt-1 w-fit rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            {roleName}
          </span>
        </div>

        <DropdownMenuSeparator />

        {/* "Meu perfil" foi removido: a rota /perfil nunca chegou a ser
            construida, entao o item so levava a um 404. Volta quando a tela
            existir. */}
        <DropdownMenuItem
          variant="destructive"
          onClick={() => logoutFormRef.current?.requestSubmit()}
        >
          <LogOut className="size-4" aria-hidden />
          Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0];
}
