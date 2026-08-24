import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileTypeFromBuffer } from "file-type";
import { AppError } from "@/lib/http/errors";

/**
 * Armazenamento de anexos.
 *
 * A decisao central esta no caminho: os arquivos ficam em `storage/`, FORA de
 * `public/`. Nao existe URL direta para nenhum anexo - o unico acesso e pela
 * rota autenticada /api/v1/attachments/[id], que confere sessao e permissao
 * sobre o chamado antes de servir os bytes.
 *
 * Se os anexos ficassem em `public/uploads/`, qualquer pessoa com o link leria
 * o anexo de qualquer chamado, sem login e sem registro. Como chamados de TI
 * carregam print de sistema, dado de folha e documento pessoal, isso seria um
 * vazamento silencioso.
 */

const MAX_BYTES = Number(process.env.MAX_UPLOAD_BYTES ?? 10 * 1024 * 1024);

/**
 * Allowlist - nunca uma lista de bloqueio.
 *
 * Bloquear ".exe, .bat, .js" e um jogo perdido: sempre falta uma extensao.
 * Permitir explicitamente o que a TI precisa receber (print, PDF, log,
 * planilha) e finito e auditavel.
 */
const ALLOWED: Record<string, string[]> = {
  "image/jpeg": ["jpg", "jpeg"],
  "image/png": ["png"],
  "image/gif": ["gif"],
  "image/webp": ["webp"],
  "application/pdf": ["pdf"],
  "text/plain": ["txt", "log"],
  "text/csv": ["csv"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ["docx"],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ["xlsx"],
  "application/zip": ["zip"],
};

/** Tipos sem assinatura binaria propria - validados por extensao + conteudo textual. */
const TEXT_LIKE = new Set(["txt", "log", "csv"]);

export type StoredFile = {
  storedName: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  checksumSha256: string;
};

function storageRoot(): string {
  const configured = process.env.STORAGE_DIR ?? "./storage/attachments";
  return path.resolve(process.cwd(), configured);
}

/** Subpasta por ano/mes: evita diretorio com dezenas de milhares de arquivos. */
function relativeFolder(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return path.join(String(year), month);
}

function extensionOf(fileName: string): string {
  return path.extname(fileName).replace(".", "").toLowerCase();
}

/**
 * Valida e grava um anexo.
 *
 * A validacao usa o MAGIC NUMBER do conteudo, nao a extensao informada: um
 * executavel renomeado para "foto.png" e recusado aqui, porque os primeiros
 * bytes do arquivo nao correspondem a um PNG.
 */
export async function saveAttachment(
  buffer: Buffer,
  originalName: string,
): Promise<StoredFile> {
  if (buffer.byteLength === 0) {
    throw new AppError("VALIDATION_ERROR", "O arquivo esta vazio.");
  }
  if (buffer.byteLength > MAX_BYTES) {
    throw new AppError(
      "FILE_TOO_LARGE",
      `Arquivo maior que o limite de ${Math.round(MAX_BYTES / 1024 / 1024)} MB.`,
    );
  }

  const declaredExt = extensionOf(originalName);
  const detected = await fileTypeFromBuffer(buffer);

  let mimeType: string;
  let extension: string;

  if (detected) {
    const allowedExts = ALLOWED[detected.mime];
    if (!allowedExts) {
      throw new AppError(
        "FILE_TYPE_NOT_ALLOWED",
        `Tipo de arquivo nao permitido (${detected.mime}).`,
      );
    }
    mimeType = detected.mime;
    extension = allowedExts.includes(declaredExt) ? declaredExt : allowedExts[0];
  } else {
    // Sem assinatura binaria: so aceitamos se a extensao for de texto E o
    // conteudo nao tiver bytes de controle (o que denunciaria um binario
    // disfarcado de .txt).
    if (!TEXT_LIKE.has(declaredExt)) {
      throw new AppError(
        "FILE_TYPE_NOT_ALLOWED",
        "Nao foi possivel identificar o tipo do arquivo.",
      );
    }
    if (buffer.subarray(0, 8000).includes(0)) {
      throw new AppError(
        "FILE_TYPE_NOT_ALLOWED",
        "O arquivo parece binario, mas tem extensao de texto.",
      );
    }
    mimeType = declaredExt === "csv" ? "text/csv" : "text/plain";
    extension = declaredExt;
  }

  // Nome gerado, nunca o nome do usuario: mata path traversal ("../../web.config"),
  // colisao entre arquivos homonimos e nomes com caracteres problematicos.
  const storedName = `${randomUUID()}.${extension}`;
  const folder = relativeFolder();
  const absoluteFolder = path.join(storageRoot(), folder);

  await mkdir(absoluteFolder, { recursive: true });
  await writeFile(path.join(absoluteFolder, storedName), buffer);

  return {
    storedName: path.join(folder, storedName).replaceAll("\\", "/"),
    originalName: sanitizeName(originalName),
    mimeType,
    sizeBytes: buffer.byteLength,
    checksumSha256: createHash("sha256").update(buffer).digest("hex"),
  };
}

/**
 * Le um anexo do disco.
 *
 * A checagem de prefixo e a ultima linha de defesa contra path traversal: mesmo
 * que um storedName corrompido chegue do banco, o caminho resolvido precisa
 * continuar dentro de storage/.
 */
export async function readAttachment(storedName: string): Promise<Buffer> {
  const root = storageRoot();
  const absolute = path.resolve(root, storedName);

  if (!absolute.startsWith(root + path.sep)) {
    throw new AppError("NOT_FOUND", "Anexo nao encontrado.");
  }

  try {
    return await readFile(absolute);
  } catch {
    throw new AppError("NOT_FOUND", "Anexo nao encontrado.");
  }
}

export async function deleteAttachment(storedName: string): Promise<void> {
  const root = storageRoot();
  const absolute = path.resolve(root, storedName);
  if (!absolute.startsWith(root + path.sep)) return;
  await unlink(absolute).catch(() => {
    // Arquivo ja removido: a exclusao do registro no banco e o que importa.
  });
}

/** Limpa o nome para exibicao e para o cabecalho Content-Disposition. */
function sanitizeName(name: string): string {
  return path
    .basename(name)
    .replaceAll(/[\u0000-\u001f\u007f"\\]/g, "")
    .slice(0, 255);
}

export const MAX_UPLOAD_BYTES = MAX_BYTES;
export const MAX_FILES_PER_TICKET = Number(
  process.env.MAX_FILES_PER_TICKET ?? 5,
);
export const ALLOWED_EXTENSIONS = Object.values(ALLOWED).flat();
