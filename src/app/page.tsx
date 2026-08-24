import { redirect } from "next/navigation";

/**
 * A raiz nao tem conteudo proprio: quem esta logado vai para o painel, quem
 * nao esta e barrado pelo middleware e cai no login.
 */
export default function Home() {
  redirect("/dashboard");
}
