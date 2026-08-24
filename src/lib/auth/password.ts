import { hash, verify } from "@node-rs/argon2";
import type { Algorithm } from "@node-rs/argon2";
import { MIN_PASSWORD_LENGTH } from "@/config/password";

/**
 * Argon2id. O valor vem escrito assim porque `Algorithm` e um `const enum`
 * ambiente do @node-rs/argon2: com `isolatedModules` (exigido pelo Next) nao e
 * possivel le-lo como valor em tempo de execucao, apenas como tipo.
 */
const ARGON2ID = 2 as Algorithm;

/**
 * Parametros do Argon2id.
 *
 * Argon2id e o algoritmo recomendado atualmente (a fase "memory-hard" e o que
 * torna ataque com GPU caro - diferente do bcrypt, que usa pouca memoria).
 * 64 MiB / 3 iteracoes segue a recomendacao do OWASP e leva ~50-100 ms por
 * hash nesta classe de maquina: imperceptivel no login, custoso para quem
 * tentar forca bruta contra um dump do banco.
 */
const ARGON2_OPTIONS = {
  algorithm: ARGON2ID,
  memoryCost: 65536, // 64 MiB
  timeCost: 3,
  parallelism: 4,
} as const;

export async function hashPassword(plain: string): Promise<string> {
  return hash(plain, ARGON2_OPTIONS);
}

/**
 * Confere a senha. Nunca lanca excecao para hash malformado: retorna false,
 * para que um registro corrompido resulte em "senha invalida" e nao em erro 500
 * (que vazaria a informacao de que aquele e-mail existe).
 */
export async function verifyPassword(
  storedHash: string,
  plain: string,
): Promise<boolean> {
  try {
    return await verify(storedHash, plain, ARGON2_OPTIONS);
  } catch {
    return false;
  }
}

/**
 * As 1000 senhas mais vazadas seriam carregadas de um arquivo em producao.
 * Esta lista curta cobre o que de fato aparece em ambiente corporativo
 * brasileiro quando o usuario e obrigado a trocar a senha.
 *
 * As entradas curtas (6 a 8 caracteres) sao ESSENCIAIS desde que o minimo caiu
 * para 6: antes, "123456" era barrado pelo comprimento e nem chegava aqui.
 * Com o minimo menor, o comprimento parou de proteger e esta lista virou a
 * unica barreira contra as senhas mais obvias que existem.
 */
const SENHAS_PROIBIDAS = new Set([
  // Curtas - a maioria absoluta das senhas reais vazadas cai aqui.
  "123456",
  "1234567",
  "12345678",
  "senha",
  "senha1",
  "senha12",
  "senha123",
  "abc123",
  "123abc",
  "qwerty",
  "asdfgh",
  "111111",
  "000000",
  "123123",
  "121212",
  "admin",
  "admin1",
  "admin123",
  "master",
  "acesso",
  "mudar",
  "mudar123",
  "brasil",
  "trocar",
  "trocar123",
  "senha@123",
  // Longas.
  "123456789",
  "1234567890",
  "senha123456",
  "password123",
  "12345678910",
  "qwertyuiop",
  "administrador",
  "empresa2026",
  "mudar123456",
  "primeiroacesso",
]);

export type PasswordCheck = { ok: true } | { ok: false; reason: string };

/**
 * Politica de senha.
 *
 * Deliberadamente NAO exigimos "1 maiuscula + 1 numero + 1 simbolo" e NAO
 * expiramos a senha periodicamente. Ambas as regras foram abandonadas pelo NIST
 * (SP 800-63B): elas empurram o usuario para "Senha@123" e para o post-it no
 * monitor. Comprimento minimo e bloqueio de senhas conhecidas protegem mais.
 */
export function checkPasswordPolicy(plain: string): PasswordCheck {
  if (plain.length < MIN_PASSWORD_LENGTH) {
    return {
      ok: false,
      reason: `A senha precisa ter ao menos ${MIN_PASSWORD_LENGTH} caracteres.`,
    };
  }
  if (plain.length > 200) {
    return { ok: false, reason: "A senha e longa demais." };
  }
  if (SENHAS_PROIBIDAS.has(plain.toLowerCase())) {
    return {
      ok: false,
      reason: "Essa senha e muito comum. Escolha outra.",
    };
  }
  if (/^(.)\1+$/.test(plain)) {
    return { ok: false, reason: "A senha nao pode ser um unico caractere repetido." };
  }
  return { ok: true };
}
