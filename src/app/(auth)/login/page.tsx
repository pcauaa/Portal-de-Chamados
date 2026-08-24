import type { Metadata } from "next";
import Image from "next/image";
import { redirect as nextRedirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { isSafeRedirect } from "@/lib/auth/safe-redirect";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Entrar" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const { redirect } = await searchParams;

  // Checagem de verdade (consulta o banco), nao a heuristica de "o cookie
  // existe" do proxy.ts. So redireciona quem tem sessao genuinamente valida -
  // por isso nao cria loop com um cookie de sessao ja revogada.
  const session = await getSession();
  if (session) {
    nextRedirect(isSafeRedirect(redirect) ? redirect! : "/dashboard");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-4 text-center">
          {/* dark:invert: a logo e arte preta sobre fundo transparente, entao
              no tema escuro ela desapareceria. Como e monocromatica, inverter
              a deixa branca sem distorcer cor nenhuma.
              priority: e a unica imagem acima da dobra da tela de login -
              carregar cedo evita o "pulo" do layout enquanto ela chega. */}
          <Image
            src="/logo.png"
            alt="Portal de Chamados"
            width={256}
            height={256}
            priority
            className="h-auto w-20 dark:invert"
          />
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              Portal de Chamados
            </h1>
            <p className="text-sm text-muted-foreground">
              Suporte de TI da empresa
            </p>
          </div>
        </div>

        <LoginForm redirectTo={redirect} />

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Esqueceu a senha? Procure o setor de TI.
        </p>
      </div>
    </main>
  );
}
