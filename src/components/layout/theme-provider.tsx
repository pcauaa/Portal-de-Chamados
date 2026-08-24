"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ComponentProps } from "react";

/**
 * Modo claro/escuro.
 *
 * `attribute="class"` porque o Tailwind v4 alterna o dark mode por classe no
 * <html>. `defaultTheme="system"` faz o primeiro acesso respeitar a preferencia
 * do sistema operacional do colaborador, em vez de impor um tema.
 *
 * `disableTransitionOnChange` evita que todas as cores da tela animem juntas na
 * troca de tema - o efeito fica lento e sujo em telas com tabela grande.
 */
export function ThemeProvider({
  children,
  ...props
}: ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}
