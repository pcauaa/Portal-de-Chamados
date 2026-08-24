"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, LoaderCircle, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { saveDepartmentAction, toggleDepartmentAction, type AdminState } from "../actions";

type DepartmentRow = {
  id: string;
  name: string;
  isActive: boolean;
  userCount: number;
  ticketCount: number;
};

const INITIAL: AdminState = { error: null };

export function DepartmentsManager({
  departments,
}: {
  departments: DepartmentRow[];
}) {
  const [editing, setEditing] = useState<DepartmentRow | null>(null);
  const [creating, setCreating] = useState(false);

  const [saveState, runSave] = useActionState(saveDepartmentAction, INITIAL);
  const [toggleState, runToggle] = useActionState(toggleDepartmentAction, INITIAL);

  const error = saveState.error ?? toggleState.error;

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
          {creating ? "Cancelar" : "Novo setor"}
        </Button>
      </div>

      {creating || editing ? (
        <form
          key={editing?.id ?? "novo"}
          action={runSave}
          className="flex flex-col gap-3 rounded-lg border bg-card p-4 sm:flex-row sm:items-end"
        >
          {editing ? (
            <input type="hidden" name="departmentId" value={editing.id} />
          ) : null}
          <div className="flex flex-1 flex-col gap-1.5">
            <Label htmlFor="dept-name">
              {editing ? `Editando ${editing.name}` : "Nome do setor"}
            </Label>
            <Input
              id="dept-name"
              name="name"
              defaultValue={editing?.name}
              required
              minLength={2}
              maxLength={80}
              placeholder="Ex.: Recursos Humanos"
            />
          </div>
          <div className="flex gap-2">
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
            <SubmitButton label={editing ? "Salvar" : "Criar"} />
          </div>
        </form>
      ) : null}

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Setor</TableHead>
              <TableHead>Colaboradores</TableHead>
              <TableHead>Chamados</TableHead>
              <TableHead>Situacao</TableHead>
              <TableHead className="text-right">Acoes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {departments.map((dept) => (
              <TableRow key={dept.id} className={cn(!dept.isActive && "opacity-60")}>
                <TableCell className="font-medium">{dept.name}</TableCell>
                <TableCell className="tabular-nums">{dept.userCount}</TableCell>
                <TableCell className="tabular-nums">{dept.ticketCount}</TableCell>
                <TableCell>
                  {dept.isActive ? (
                    <Badge
                      variant="outline"
                      className="border-transparent bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-300"
                    >
                      Ativo
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="border-transparent bg-muted">
                      Inativo
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setEditing(dept);
                        setCreating(false);
                      }}
                    >
                      <Pencil className="size-3.5" aria-hidden />
                      Editar
                    </Button>
                    <form action={runToggle}>
                      <input type="hidden" name="departmentId" value={dept.id} />
                      <input
                        type="hidden"
                        name="isActive"
                        value={String(!dept.isActive)}
                      />
                      <ToggleButton isActive={dept.isActive} />
                    </form>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
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
