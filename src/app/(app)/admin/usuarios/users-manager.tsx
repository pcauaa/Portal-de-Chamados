"use client";

import { Fragment, useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  AlertCircle,
  Check,
  Copy,
  Dice5,
  KeyRound,
  LoaderCircle,
  LockOpen,
  Pencil,
  Trash2,
  TriangleAlert,
  UserPlus,
} from "lucide-react";
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
import { MIN_PASSWORD_LENGTH } from "@/config/password";
import {
  createUserAction,
  updateUserAction,
  toggleUserAction,
  resetPasswordAction,
  setPasswordAction,
  unlockUserAction,
  deleteUserAction,
  type AdminState,
} from "../actions";

type UserRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  isActive: boolean;
  isLocked: boolean;
  lastLoginAt: string | null;
  roleId: string;
  roleName: string;
  departmentId: string | null;
  departmentName: string | null;
  ticketCount: number;
};

type Option = { id: string; name: string };

const INITIAL: AdminState = { error: null };

export function UsersManager({
  currentUserId,
  users,
  roles,
  departments,
}: {
  currentUserId: string;
  users: UserRow[];
  roles: Option[];
  departments: Option[];
}) {
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [passwordRowFor, setPasswordRowFor] = useState<string | null>(null);
  const [deleteRowFor, setDeleteRowFor] = useState<string | null>(null);

  const [createState, runCreate] = useActionState(createUserAction, INITIAL);
  const [updateState, runUpdate] = useActionState(updateUserAction, INITIAL);
  const [toggleState, runToggle] = useActionState(toggleUserAction, INITIAL);
  const [resetState, runReset] = useActionState(resetPasswordAction, INITIAL);
  const [setPwState, runSetPassword] = useActionState(setPasswordAction, INITIAL);
  const [unlockState, runUnlock] = useActionState(unlockUserAction, INITIAL);
  const [deleteState, runDelete] = useActionState(deleteUserAction, INITIAL);

  // A senha aparece uma unica vez, vinda de criar, sortear ou definir.
  const generated = createState.password
    ? createState
    : resetState.password
      ? resetState
      : setPwState.password
        ? setPwState
        : null;

  const error =
    createState.error ??
    updateState.error ??
    toggleState.error ??
    resetState.error ??
    setPwState.error ??
    unlockState.error ??
    deleteState.error;

  return (
    <div className="flex flex-col gap-4">
      {generated?.password ? (
        <TemporaryPassword
          password={generated.password}
          email={generated.passwordFor ?? ""}
          wasGenerated={generated.passwordWasGenerated ?? true}
        />
      ) : null}

      {error ? (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{error}</span>
        </div>
      ) : null}

      {deleteState.notice ? (
        <div
          role="status"
          className="flex items-start gap-2 rounded-md border border-green-600/20 bg-green-50 p-3 text-sm text-green-800 dark:bg-green-500/10 dark:text-green-300"
        >
          <Check className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{deleteState.notice}</span>
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
          <UserPlus className="size-4" aria-hidden />
          {creating ? "Cancelar" : "Novo usuario"}
        </Button>
      </div>

      {creating ? (
        <form
          action={runCreate}
          className="flex flex-col gap-3 rounded-lg border bg-card p-4"
        >
          <h2 className="text-sm font-semibold">Novo usuario</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nome completo" htmlFor="name">
              <Input id="name" name="name" required minLength={3} maxLength={120} />
            </Field>
            <Field label="E-mail" htmlFor="email">
              <Input id="email" name="email" type="email" required maxLength={160} />
            </Field>
            <Field label="Perfil" htmlFor="roleId">
              <SelectNative id="roleId" name="roleId" required options={roles} />
            </Field>
            <Field label="Setor" htmlFor="departmentId">
              <SelectNative
                id="departmentId"
                name="departmentId"
                options={departments}
                placeholder="Sem setor"
              />
            </Field>
            <Field label="Telefone / ramal (opcional)" htmlFor="phone">
              <Input id="phone" name="phone" maxLength={20} />
            </Field>
            <Field label="Senha (opcional)" htmlFor="password">
              <Input
                id="password"
                name="password"
                type="text"
                minLength={MIN_PASSWORD_LENGTH}
                maxLength={200}
                placeholder="Deixe em branco para gerar automaticamente"
              />
            </Field>
          </div>
          <p className="text-xs text-muted-foreground">
            Se voce digitar uma senha, minimo {MIN_PASSWORD_LENGTH} caracteres.
            Se deixar em branco, o sistema sorteia uma. Nos dois casos ela ja
            fica valendo como a senha da conta - so um administrador pode
            troca-la depois, por esta tela.
          </p>
          <SubmitButton label="Criar usuario" className="self-end" />
        </form>
      ) : null}

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Usuario</TableHead>
              <TableHead>Perfil</TableHead>
              <TableHead>Setor</TableHead>
              <TableHead>Chamados</TableHead>
              <TableHead>Situacao</TableHead>
              <TableHead className="text-right">Acoes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <Fragment key={user.id}>
              <TableRow className={cn(!user.isActive && "opacity-60")}>
                <TableCell>
                  <span className="block font-medium">{user.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {user.email}
                  </span>
                </TableCell>
                <TableCell className="text-sm">{user.roleName}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {user.departmentName ?? "-"}
                </TableCell>
                <TableCell className="text-sm tabular-nums">
                  {user.ticketCount}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {user.isActive ? (
                      <Badge
                        variant="outline"
                        className="border-transparent bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-300"
                      >
                        Ativo
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="border-transparent bg-muted">
                        Desativado
                      </Badge>
                    )}
                    {user.isLocked ? (
                      <Badge
                        variant="outline"
                        className="border-transparent bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300"
                      >
                        Bloqueado
                      </Badge>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap justify-end gap-1">
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      aria-label={`Editar ${user.name}`}
                      title="Editar"
                      onClick={() => {
                        setEditing(editing?.id === user.id ? null : user);
                        setCreating(false);
                      }}
                    >
                      <Pencil className="size-3.5" aria-hidden />
                    </Button>

                    {user.isLocked ? (
                      <form action={runUnlock}>
                        <input type="hidden" name="userId" value={user.id} />
                        <IconSubmit label="Destravar conta">
                          <LockOpen className="size-3.5" aria-hidden />
                        </IconSubmit>
                      </form>
                    ) : null}

                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      aria-label={`Definir senha de ${user.name}`}
                      title="Definir senha"
                      onClick={() =>
                        setPasswordRowFor(passwordRowFor === user.id ? null : user.id)
                      }
                    >
                      <KeyRound className="size-3.5" aria-hidden />
                    </Button>

                    {/* O admin logado nao pode desativar nem excluir a si
                        mesmo - ficaria fora do sistema sem ninguem para
                        reativa-lo. */}
                    {user.id !== currentUserId ? (
                      <>
                        <form action={runToggle}>
                          <input type="hidden" name="userId" value={user.id} />
                          <input
                            type="hidden"
                            name="isActive"
                            value={String(!user.isActive)}
                          />
                          <TextSubmit
                            label={user.isActive ? "Desativar" : "Reativar"}
                            destructive={user.isActive}
                          />
                        </form>

                        <Button
                          type="button"
                          size="icon-sm"
                          variant="ghost"
                          aria-label={`Excluir ${user.name}`}
                          title="Excluir definitivamente"
                          className="text-destructive hover:bg-destructive/10"
                          onClick={() =>
                            setDeleteRowFor(deleteRowFor === user.id ? null : user.id)
                          }
                        >
                          <Trash2 className="size-3.5" aria-hidden />
                        </Button>
                      </>
                    ) : (
                      <span className="px-2 text-xs text-muted-foreground">Voce</span>
                    )}
                  </div>
                </TableCell>
              </TableRow>

              {deleteRowFor === user.id ? (
                <TableRow key={`${user.id}-excluir`}>
                  <TableCell colSpan={6} className="bg-destructive/5">
                    <div className="flex flex-wrap items-center gap-3 py-1">
                      <TriangleAlert
                        className="size-4 shrink-0 text-destructive"
                        aria-hidden
                      />
                      <div className="min-w-0 flex-1 text-sm">
                        <p className="font-medium">
                          Excluir {user.name} definitivamente?
                        </p>
                        <p className="text-muted-foreground">
                          {user.ticketCount > 0 ? (
                            <>
                              Os <strong>{user.ticketCount} chamados</strong> abertos
                              por esta pessoa serao apagados junto, com comentarios e
                              anexos. Eles somem dos indicadores. Nao da para desfazer.
                            </>
                          ) : (
                            <>
                              Esta conta nao tem chamados. Nada de historico se perde.
                            </>
                          )}{" "}
                          Para so tirar o acesso mantendo o historico, use
                          &ldquo;Desativar&rdquo;.
                        </p>
                      </div>

                      <form action={runDelete} className="flex items-center gap-2">
                        <input type="hidden" name="userId" value={user.id} />
                        <input type="hidden" name="confirmar" value="sim" />
                        <ConfirmDeleteSubmit
                          label={
                            user.ticketCount > 0
                              ? `Excluir e apagar ${user.ticketCount} chamado(s)`
                              : "Excluir"
                          }
                        />
                      </form>

                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteRowFor(null)}
                      >
                        Cancelar
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : null}

              {passwordRowFor === user.id ? (
                <TableRow key={`${user.id}-senha`}>
                  <TableCell colSpan={6} className="bg-muted/40">
                    <div className="flex flex-wrap items-end gap-2 py-1">
                      <form
                        action={runSetPassword}
                        className="flex flex-wrap items-end gap-2"
                      >
                        <input type="hidden" name="userId" value={user.id} />
                        <input type="hidden" name="email" value={user.email} />
                        <Field
                          label={`Nova senha para ${user.name}`}
                          htmlFor={`newpw-${user.id}`}
                        >
                          <Input
                            id={`newpw-${user.id}`}
                            name="password"
                            type="text"
                            minLength={MIN_PASSWORD_LENGTH}
                            maxLength={200}
                            placeholder="Digite a nova senha"
                            className="w-56"
                          />
                        </Field>
                        <TextSubmit label="Definir" destructive={false} />
                      </form>

                      <form action={runReset}>
                        <input type="hidden" name="userId" value={user.id} />
                        <input type="hidden" name="email" value={user.email} />
                        <RandomPasswordSubmit />
                      </form>

                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setPasswordRowFor(null)}
                      >
                        Fechar
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : null}
              </Fragment>
            ))}
          </TableBody>
        </Table>
      </div>

      {editing ? (
        <form
          action={runUpdate}
          className="flex flex-col gap-3 rounded-lg border bg-card p-4"
        >
          <h2 className="text-sm font-semibold">Editando {editing.name}</h2>
          <input type="hidden" name="userId" value={editing.id} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nome completo" htmlFor="edit-name">
              <Input
                id="edit-name"
                name="name"
                defaultValue={editing.name}
                required
                minLength={3}
              />
            </Field>
            <Field label="Perfil" htmlFor="edit-role">
              <SelectNative
                id="edit-role"
                name="roleId"
                options={roles}
                defaultValue={editing.roleId}
                required
                disabled={editing.id === currentUserId}
              />
            </Field>
            <Field label="Setor" htmlFor="edit-dept">
              <SelectNative
                id="edit-dept"
                name="departmentId"
                options={departments}
                defaultValue={editing.departmentId ?? ""}
                placeholder="Sem setor"
              />
            </Field>
            <Field label="Telefone / ramal" htmlFor="edit-phone">
              <Input
                id="edit-phone"
                name="phone"
                defaultValue={editing.phone ?? ""}
                maxLength={20}
              />
            </Field>
          </div>
          {editing.id === currentUserId ? (
            <p className="text-xs text-muted-foreground">
              Voce nao pode alterar o proprio perfil de acesso.
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
            <SubmitButton label="Salvar" />
          </div>
        </form>
      ) : null}
    </div>
  );
}

/**
 * Mostrada uma unica vez: a senha em claro nunca volta a existir depois desta
 * resposta, seja ela sorteada pelo sistema ou digitada pelo admin.
 */
function TemporaryPassword({
  password,
  email,
  wasGenerated,
}: {
  password: string;
  email: string;
  wasGenerated: boolean;
}) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-amber-500/40 bg-amber-50/70 p-4 dark:bg-amber-500/5">
      <p className="text-sm font-medium">
        {wasGenerated ? "Senha gerada" : "Senha definida"}
      </p>
      <p className="text-xs text-muted-foreground">
        {wasGenerated
          ? `Anote e repasse a ${email}. Ela nao sera exibida de novo - se perder, gere outra por aqui.`
          : `Repasse a ${email}. Esta e a senha da conta ate um administrador definir outra.`}
      </p>
      <div className="flex items-center gap-2">
        <code className="rounded bg-background px-3 py-1.5 font-mono text-sm">
          {password}
        </code>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => {
            navigator.clipboard.writeText(password);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
        >
          {copied ? (
            <>
              <Check className="size-3.5" aria-hidden />
              Copiado
            </>
          ) : (
            <>
              <Copy className="size-3.5" aria-hidden />
              Copiar
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}

/**
 * Select nativo em vez do componente do shadcn: o do shadcn nao envia valor em
 * submit de formulario sem um campo oculto controlado, e aqui a acao roda no
 * servidor lendo o FormData direto.
 */
function SelectNative({
  id,
  name,
  options,
  defaultValue,
  placeholder,
  required,
  disabled,
}: {
  id: string;
  name: string;
  options: Option[];
  defaultValue?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
}) {
  return (
    <select
      id={id}
      name={name}
      defaultValue={defaultValue}
      required={required}
      disabled={disabled}
      className="h-8 rounded-lg border border-input bg-background px-2 text-sm disabled:opacity-50"
    >
      {placeholder ? <option value="">{placeholder}</option> : null}
      {options.map((option) => (
        <option key={option.id} value={option.id}>
          {option.name}
        </option>
      ))}
    </select>
  );
}

function SubmitButton({ label, className }: { label: string; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className={className}>
      {pending ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : null}
      {label}
    </Button>
  );
}

function IconSubmit({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      size="icon-sm"
      variant="ghost"
      disabled={pending}
      aria-label={label}
      title={label}
    >
      {pending ? (
        <LoaderCircle className="size-3.5 animate-spin" aria-hidden />
      ) : (
        children
      )}
    </Button>
  );
}

function RandomPasswordSubmit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="outline" size="sm" disabled={pending}>
      {pending ? (
        <LoaderCircle className="size-3.5 animate-spin" aria-hidden />
      ) : (
        <Dice5 className="size-3.5" aria-hidden />
      )}
      Gerar aleatoria
    </Button>
  );
}

function ConfirmDeleteSubmit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" variant="destructive" disabled={pending}>
      {pending ? (
        <LoaderCircle className="size-3.5 animate-spin" aria-hidden />
      ) : (
        <Trash2 className="size-3.5" aria-hidden />
      )}
      {label}
    </Button>
  );
}

function TextSubmit({ label, destructive }: { label: string; destructive: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      size="sm"
      variant={destructive ? "destructive" : "outline"}
      disabled={pending}
    >
      {pending ? <LoaderCircle className="size-3.5 animate-spin" aria-hidden /> : null}
      {label}
    </Button>
  );
}
