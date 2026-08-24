"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // O tema so e conhecido no cliente. Renderizar o icone antes da montagem
  // produziria HTML diferente no servidor e no navegador - erro de hidratacao.
  useEffect(() => setMounted(true), []);

  const isDark = mounted && resolvedTheme === "dark";

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      // O aria-label tambem precisa do guarda `mounted`: o servidor nao conhece
      // o tema, entao renderizar o rotulo a partir de resolvedTheme gera HTML
      // diferente no servidor e no cliente - erro de hidratacao. Enquanto nao
      // montou, o rotulo fica neutro.
      aria-label={
        mounted ? (isDark ? "Usar tema claro" : "Usar tema escuro") : "Alternar tema"
      }
    >
      {mounted ? (
        isDark ? (
          <Sun className="size-4" aria-hidden />
        ) : (
          <Moon className="size-4" aria-hidden />
        )
      ) : (
        <span className="size-4" />
      )}
    </Button>
  );
}
