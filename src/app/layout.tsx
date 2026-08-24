import type { Metadata } from "next";
import "./globals.css";
import { Geist } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/layout/theme-provider";
import { cn } from "@/lib/utils";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: {
    default: "Portal de Chamados",
    template: "%s | Portal de Chamados",
  },
  description: "Abertura e acompanhamento de chamados do setor de TI.",
  // Sistema interno: nao deve aparecer em buscador algum, mesmo que um dia
  // seja publicado com acesso externo.
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // suppressHydrationWarning e exigido pelo next-themes: ele injeta a classe
    // do tema no <html> antes da hidratacao para evitar o flash de tela branca
    // em quem usa modo escuro.
    <html
      lang="pt-BR"
      className={cn("font-sans", geist.variable)}
      suppressHydrationWarning
    >
      <body className="min-h-screen bg-background text-foreground antialiased">
        <ThemeProvider>
          {children}
          <Toaster richColors closeButton position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
