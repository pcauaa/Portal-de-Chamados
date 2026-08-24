/**
 * So aceita caminho interno.
 *
 * Sem esta checagem, o parametro ?redirect= viraria um open redirect: bastaria
 * mandar ao colaborador um link /login?redirect=https://site-falso para que,
 * apos autenticar de verdade, ele fosse levado a uma pagina clonada de coleta
 * de senha. O "//" tambem e bloqueado porque o navegador o interpreta como
 * outro dominio.
 */
export function isSafeRedirect(path: string | undefined): path is string {
  return !!path && path.startsWith("/") && !path.startsWith("//");
}
