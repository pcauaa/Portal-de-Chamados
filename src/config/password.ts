/**
 * Comprimento minimo da senha.
 *
 * Mora em config/ e nao em lib/auth/password.ts de proposito: aquele arquivo
 * importa o Argon2, um modulo NATIVO. Os formularios de senha sao componentes
 * de cliente e precisam deste numero para o atributo minLength - importa-lo de
 * la arrastaria o Argon2 para o bundle do navegador (e quebraria o build).
 *
 * Aqui e um arquivo sem nenhuma dependencia, seguro para os dois lados.
 *
 * 6 e uma escolha consciente para este contexto: rede interna, sem exposicao
 * externa, senhas entregues pessoalmente pelo admin. Quem protege de verdade
 * aqui e a lista de senhas obvias bloqueadas em lib/auth/password.ts, nao o
 * comprimento.
 */
export const MIN_PASSWORD_LENGTH = 6;
