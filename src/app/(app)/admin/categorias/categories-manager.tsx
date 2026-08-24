"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, LoaderCircle, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { CategoryIcon } from "@/components/tickets/category-icon";
import { PriorityBadge } from "@/components/tickets/priority-badge";
import { PRIORITY_META, PRIORITY_ORDER } from "@/config/status";
import type { Priority } from "@/generated/prisma/enums";
import { cn } from "@/lib/utils";
import { saveCategoryAction, toggleCategoryAction, type AdminState } from "../actions";

type CategoryRow = {
  id: string;
  name: string;
  description: string | null;
  icon: string;
  defaultPriority: Priority;
  slaHours: number | null;
  isActive: boolean;
  ticketCount: number;
};

/** Icones disponiveis - os mesmos que CategoryIcon sabe desenhar. */
const ICON_OPTIONS = [
  "monitor",
  "printer",
  "wifi",
  "database",
  "mail",
  "network",
  "phone",
  "hard-drive",
  "key-round",
  "circle-help",
];

const INITIAL: AdminState = { error: null };

export function CategoriesManager({ categories }: { categories: CategoryRow[] }) {
  const [editing, setEditing] = useState<CategoryRow | null>(null);
  const [creating, setCreating] = useState(false);

  const [saveState, runSave] = useActionState(saveCategoryAction, INITIAL);
  const [toggleState, runToggle] = useActionState(toggleCategoryAction, INITIAL);

  const error = saveState.error ?? toggleState.error;
  const form = editing ?? null;

  return (
    <div className="flex flex-col gap-4">
      {error ? (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{error}</span>
        </div>
      ) : null}

      <div className="flex justify-end">
        <Button
          type="button"
          onClick={() => {
            setCreating((v) => !v);
            setEditing(null);
          }}
        >
          <Plus className="size-4" aria-hidden />
          {creating ? "Cancelar" : "Nova categoria"}
        </Button>
      </div>

      {creating || form ? (
        <form
          key={form?.id ?? "nova"}
          action={runSave}
          className="flex flex-col gap-3 rounded-lg border bg-card p-4"
        >
          <h2 className="text-sm font-semibold">
            {form ? `Editando ${form.name}` : "Nova categoria"}
          </h2>
          {form ? <input type="hidden" name="categoryId" value={form.id} /> : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cat-name">Nome</Label>
              <Input
                id="cat-name"
                name="name"
                defaultValue={form?.name}
                required
                minLength={2}
                maxLength={60}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cat-priority">Prioridade padrao</Label>
              <select
                id="cat-priority"
                name="defaultPriority"
                defaultValue={form?.defaultPriority ?? "MEDIA"}
                className="h-8 rounded-lg border border-input bg-background px-2 text-sm"
              >
                {PRIORITY_ORDER.map((p) => (
                  <option key={p} value={p}>
                    {PRIORITY_META[p].label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="cat-desc">Texto de ajuda</Label>
              <Textarea
                id="cat-desc"
                name="description"
                defaultValue={form?.description ?? ""}
                maxLength={200}
                rows={2}
                placeholder="Aparece abaixo dos cards no formulario de abertura."
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cat-icon">Icone</Label>
              <select
                id="cat-icon"
                name="icon"
                defaultValue={form?.icon ?? "circle-help"}
                className="h-8 rounded-lg border border-input bg-background px-2 text-sm"
              >
                {ICON_OPTIONS.map((icon) => (
                  <option key={icon} value={icon}>
                    {icon}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cat-sla">Prazo alvo em horas (opcional)</Label>
              <Input
                id="cat-sla"
                name="slaHours"
                type="number"
                min={1}
                max={720}
                defaultValue={form?.slaHours ?? ""}
                placeholder="Sem prazo definido"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setEditing(null);
                setCreating(false);
              }}
            >
              Cancelar
            </Button>
            <SubmitButton label={form ? "Salvar" : "Criar categoria"} />
          </div>
        </form>
      ) : null}

      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((category) => (
          <li
            key={category.id}
            className={cn(
              "flex flex-col gap-2 rounded-lg border bg-card p-4",
              !category.isActive && "opacity-60",
            )}
          >
            <div className="flex items-start gap-2">
              <CategoryIcon
                icon={category.icon}
                className="mt-0.5 size-4 shrink-0 text-muted-foreground"
              />
              <div className="min-w-0 flex-1">
                <p className="font-medium">{category.name}</p>
                {category.description ? (
                  <p className="text-xs text-muted-foreground">
                    {category.description}
                  </p>
                ) : null}
              </div>
              {!category.isActive ? (
                <Badge variant="outline" className="shrink-0 border-transparent bg-muted">
                  Inativa
                </Badge>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <PriorityBadge priority={category.defaultPriority} />
              {category.slaHours ? <span>Prazo: {category.slaHours}h</span> : null}
              <span>
                {category.ticketCount}{" "}
                {category.ticketCount === 1 ? "chamado" : "chamados"}
              </span>
            </div>

            <div className="mt-auto flex justify-end gap-1 pt-1">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  setEditing(category);
                  setCreating(false);
                }}
              >
                <Pencil className="size-3.5" aria-hidden />
                Editar
              </Button>

              <form action={runToggle}>
                <input type="hidden" name="categoryId" value={category.id} />
                <input
                  type="hidden"
                  name="isActive"
                  value={String(!category.isActive)}
                />
                <ToggleButton isActive={category.isActive} />
              </form>
            </div>
          </li>
        ))}
      </ul>

      <p className="text-xs text-muted-foreground">
        Categorias sao desativadas, nunca excluidas: uma categoria com chamados
        no historico nao pode sumir sem quebrar os relatorios dos anos
        anteriores. Desativar remove do formulario de abertura e preserva tudo.
      </p>
    </div>
  );
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : null}
      {label}
    </Button>
  );
}

function ToggleButton({ isActive }: { isActive: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      size="sm"
      variant={isActive ? "destructive" : "outline"}
      disabled={pending}
    >
      {pending ? <LoaderCircle className="size-3.5 animate-spin" aria-hidden /> : null}
      {isActive ? "Desativar" : "Reativar"}
    </Button>
  );
}
