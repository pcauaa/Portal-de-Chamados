"use client";

import { useActionState, useMemo, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, CloudUpload, LoaderCircle, Paperclip, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PriorityBadge } from "@/components/tickets/priority-badge";
import { CategoryIcon } from "@/components/tickets/category-icon";
import { cn } from "@/lib/utils";
import type { Priority } from "@/generated/prisma/enums";
import { createTicketAction, type NewTicketFormState } from "../actions";

type CategoryOption = {
  id: string;
  name: string;
  description: string | null;
  icon: string;
  defaultPriority: Priority;
};

const INITIAL: NewTicketFormState = { error: null };

export function NewTicketForm({
  categories,
  maxFiles,
  maxFileBytes,
}: {
  categories: CategoryOption[];
  maxFiles: number;
  maxFileBytes: number;
}) {
  const [state, formAction] = useActionState(createTicketAction, INITIAL);
  const [categoryId, setCategoryId] = useState<string>("");
  const [localError, setLocalError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const selectedCategory = useMemo(
    () => categories.find((c) => c.id === categoryId) ?? null,
    [categories, categoryId],
  );

  function syncInput(next: File[]) {
    const dt = new DataTransfer();
    for (const file of next) dt.items.add(file);
    if (fileInputRef.current) fileInputRef.current.files = dt.files;
    setFiles(next);
  }

  function addFiles(incoming: FileList | File[]) {
    setLocalError(null);
    const merged = [...files];

    for (const file of Array.from(incoming)) {
      if (merged.length >= maxFiles) {
        setLocalError(`Voce pode anexar no maximo ${maxFiles} arquivos.`);
        break;
      }
      if (file.size > maxFileBytes) {
        setLocalError(`"${file.name}" e maior que ${formatMB(maxFileBytes)}.`);
        continue;
      }
      if (merged.some((f) => f.name === file.name && f.size === file.size)) {
        continue; // ja adicionado
      }
      merged.push(file);
    }

    syncInput(merged);
  }

  function removeFile(index: number) {
    syncInput(files.filter((_, i) => i !== index));
  }

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <Card>
        <CardContent className="pt-6">
          <fieldset className="flex flex-col gap-2">
            <Label>Categoria</Label>
            <div
              role="radiogroup"
              aria-label="Categoria do chamado"
              className="grid grid-cols-2 gap-2 sm:grid-cols-3"
            >
              {categories.map((category) => (
                <label
                  key={category.id}
                  className={cn(
                    "flex cursor-pointer flex-col items-center gap-1.5 rounded-lg border p-3 text-center transition-colors",
                    "hover:bg-muted/60",
                    "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
                    categoryId === category.id
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "border-border",
                  )}
                >
                  <input
                    type="radio"
                    name="categoryId"
                    value={category.id}
                    required
                    className="sr-only"
                    checked={categoryId === category.id}
                    onChange={() => setCategoryId(category.id)}
                  />
                  <CategoryIcon icon={category.icon} className="size-5 text-muted-foreground" />
                  <span className="text-xs font-medium leading-tight">{category.name}</span>
                </label>
              ))}
            </div>
            {selectedCategory ? (
              <p className="flex flex-wrap items-center gap-1.5 pt-1 text-xs text-muted-foreground">
                {selectedCategory.description}
                <span className="inline-flex items-center gap-1">
                  Prioridade inicial:
                  <PriorityBadge priority={selectedCategory.defaultPriority} />
                </span>
              </p>
            ) : (
              <p className="pt-1 text-xs text-muted-foreground">
                A prioridade e definida pela categoria - a TI pode ajustar depois.
              </p>
            )}
          </fieldset>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-4 pt-6">
          <div className="flex flex-col gap-2">
            <Label htmlFor="title">Titulo</Label>
            <Input
              id="title"
              name="title"
              placeholder="Ex.: Computador nao liga"
              minLength={5}
              maxLength={140}
              required
              autoFocus
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="description">Descricao</Label>
            <Textarea
              id="description"
              name="description"
              placeholder="O que aconteceu? Quando comecou? Ja tentou alguma solucao?"
              minLength={10}
              maxLength={5000}
              rows={5}
              required
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Anexos (opcional)</Label>
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                addFiles(e.dataTransfer.files);
              }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click();
              }}
              className={cn(
                "flex cursor-pointer flex-col items-center gap-1.5 rounded-lg border border-dashed p-6 text-center transition-colors",
                isDragging ? "border-primary bg-primary/5" : "border-border hover:bg-muted/60",
              )}
            >
              <CloudUpload className="size-6 text-muted-foreground" aria-hidden />
              <p className="text-sm text-muted-foreground">
                Arraste arquivos aqui ou clique para escolher
              </p>
              <p className="text-xs text-muted-foreground">
                Ate {maxFiles} arquivos, {formatMB(maxFileBytes)} cada
              </p>
              <input
                ref={fileInputRef}
                type="file"
                name="files"
                multiple
                className="sr-only"
                accept="image/jpeg,image/png,image/gif,image/webp,application/pdf,text/plain,text/csv,.docx,.xlsx,.zip"
                onChange={(e) => e.target.files && addFiles(e.target.files)}
              />
            </div>

            {files.length > 0 ? (
              <ul className="flex flex-col gap-1.5">
                {files.map((file, index) => (
                  <li
                    key={`${file.name}-${file.size}-${index}`}
                    className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm"
                  >
                    <Paperclip className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="min-w-0 flex-1 truncate">{file.name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatFileSize(file.size)}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeFile(index)}
                      aria-label={`Remover ${file.name}`}
                      className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      <X className="size-3.5" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          {localError || state.error ? (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>{localError ?? state.error}</span>
            </div>
          ) : null}

          <SubmitButton />
        </CardContent>
      </Card>
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full sm:w-auto sm:self-end">
      {pending ? (
        <>
          <LoaderCircle className="size-4 animate-spin" aria-hidden />
          Abrindo chamado...
        </>
      ) : (
        "Abrir chamado"
      )}
    </Button>
  );
}

function formatMB(bytes: number): string {
  return `${Math.round(bytes / 1024 / 1024)} MB`;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
