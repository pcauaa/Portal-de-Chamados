import { NextResponse, type NextRequest } from "next/server";

/**
 * Primeira barreira de acesso.
 *
 * (No Next 16 esta convencao passou a se chamar `proxy`; era `middleware` ate
 * a versao 15.)
 *
 * Roda no Edge Runtime, onde nao ha acesso ao banco: NAO consegue validar a
 * sessao de verdade, apenas verificar se o cookie existe. O papel dele e so
 * evitar renderizar telas do app para quem claramente nao esta logado.
 *
 * A checagem que vale e feita em cada pagina (requirePage) e em cada rota de
 * API (requireSession), que consultam o banco e conferem expiracao, revogacao,
 * usuario desativado e permissao. Um cookie forjado passa por aqui e morre la.
 * Esta e a camada de conveniencia; a de seguranca vem depois.
 */

const COOKIE_NAME = "chamados_session";

/** Rotas acessiveis sem sessao. */
const PUBLIC_PATHS = ["/login"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const hasCookie = request.cookies.has(COOKIE_NAME);
  const isPublic = PUBLIC_PATHS.some((path) => pathname.startsWith(path));

  // O redirecionamento "ja logado -> painel" para quem abre /login NAO fica
  // aqui de proposito. Aqui so sabemos que o cookie EXISTE, nao que a sessao
  // ainda e valida - e um cookie de sessao revogada (ex.: apos redefinir a
  // propria senha, que derruba todas as sessoes) continua existindo no
  // navegador. Se essa decisao ficasse aqui, o resultado seria um loop:
  // /login manda para /dashboard (cookie existe) -> /dashboard confere de
  // verdade, ve a sessao revogada, manda de volta para /login -> repete para
  // sempre (ERR_TOO_MANY_REDIRECTS). A pagina /login faz essa checagem de
  // verdade, consultando o banco, entao so redireciona quando a sessao
  // realmente esta valida.
  if (isPublic) {
    return NextResponse.next();
  }

  if (!hasCookie) {
    const loginUrl = new URL("/login", request.url);
    // Preserva o destino para voltar depois do login - sem isso, quem clica
    // no link de um chamado por e-mail cai no painel generico.
    if (pathname !== "/") {
      loginUrl.searchParams.set("redirect", pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  /**
   * Nao intercepta: rotas de API (elas tratam a propria autenticacao e devem
   * responder 401 em JSON, nunca redirecionar), assets do Next e arquivos
   * estaticos.
   */
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
