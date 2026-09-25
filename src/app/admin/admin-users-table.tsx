"use client";

import {
  type FormEvent,
  useCallback,
  useMemo,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type PaginationState,
  type SortingState,
} from "@tanstack/react-table";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ArrowUpDownIcon,
  CopyIcon,
  Loader2Icon,
  MailPlusIcon,
  SearchIcon,
  UsersRoundIcon,
} from "lucide-react";
import { toast } from "sonner";

import { inviteUser, updateUserRole } from "@/app/admin/actions";
import { useInteractiveErrors } from "@/components/forms/use-interactive-errors";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  authRoleNames,
  defaultAuthRole,
  type AuthRole,
} from "@/lib/auth-role-values";
import type { AuthUserWithAccounts } from "@/lib/auth-users";
import { InviteUserFormSchema } from "@/lib/schema/authForms";

const inviteClientState = { ok: false };

const roleLabels: Record<AuthRole, string> = {
  admin: "Admin",
  docente: "Docente",
  "docente-investigador": "Docente investigador",
  "docente-organizador": "Docente organizador",
  estudiante: "Estudiante",
};

const providerLabels: Record<string, string> = {
  credential: "Usuario y contraseña",
  google: "Google",
};

const rolePermissionSummary: Record<AuthRole, string> = {
  admin: "Gestion completa",
  docente: "Revision de estacion",
  "docente-investigador": "Asistente de investigacion",
  "docente-organizador": "Puede crear viajes",
  estudiante: "Registro de estacion",
};

type InviteResult = Awaited<ReturnType<typeof inviteUser>>;

export function AdminUsersTable({ users }: { users: AuthUserWithAccounts[] }) {
  const router = useRouter();
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState<AuthRole | "all">("all");
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [inviteError, setInviteError] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<AuthRole>("docente-investigador");
  const [isRolePending, startRoleTransition] = useTransition();
  const [isInvitePending, startInviteTransition] = useTransition();
  const inviteValue = { email: inviteEmail, role: inviteRole };
  const inviteValidation = InviteUserFormSchema.safeParse(inviteValue);
  const {
    visibleErrors: inviteFieldErrors,
    onBlurCapture: onInviteBlur,
    revealErrors: revealInviteErrors,
    resetErrors: resetInviteErrors,
  } = useInteractiveErrors({
    value: inviteValue,
    actionState: inviteClientState,
    isPending: isInvitePending,
    validationError: inviteValidation.success ? undefined : inviteValidation.error,
  });

  const handleRoleChange = useCallback((userId: string, role: AuthRole) => {
    startRoleTransition(async () => {
      const result = await updateUserRole(userId, role);

      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      toast.success(result.message);
      router.refresh();
    });
  }, [router]);

  function handleInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (revealInviteErrors(event)) return;
    setInviteError("");
    setTemporaryPassword("");

    const form = event.currentTarget;
    const formData = new FormData(form);

    startInviteTransition(async () => {
      const result: InviteResult = await inviteUser(formData);

      if (!result.ok) {
        setInviteError(result.message);
        toast.error(result.message);
        return;
      }

      form.reset();
      setInviteEmail("");
      setInviteRole("docente-investigador");
      resetInviteErrors();
      setTemporaryPassword(result.temporaryPassword ?? "");
      toast.success(result.message);
      router.refresh();
    });
  }

  const filteredUsers = useMemo(() => {
    if (roleFilter === "all") {
      return users;
    }

    return users.filter((user) => (user.role ?? defaultAuthRole) === roleFilter);
  }, [roleFilter, users]);

  const columns = useMemo<ColumnDef<AuthUserWithAccounts>[]>(
    () => [
      {
        accessorFn: (user) => `${user.name} ${user.email}`,
        cell: ({ row }) => (
          <div className="flex min-w-0 items-center gap-3">
            <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-primary/15 bg-primary/10 text-xs font-semibold text-primary">
              {row.original.name.slice(0, 1).toUpperCase()}
            </span>
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="truncate font-semibold text-foreground">{row.original.name}</span>
              <span className="truncate text-xs text-muted-foreground" title={row.original.email}>
                {row.original.email}
              </span>
            </div>
          </div>
        ),
        header: ({ column }) => (
          <Button
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            size="sm"
            variant="ghost"
          >
            Usuario
            <ArrowUpDownIcon aria-hidden="true" data-icon="inline-end" />
          </Button>
        ),
        id: "user",
      },
      {
        accessorFn: (user) => formatProviders(user.providers),
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {formatProviders(row.original.providers)}
          </span>
        ),
        header: "Accesos",
        id: "providers",
      },
      {
        accessorFn: (user) => roleLabels[user.role ?? defaultAuthRole],
        cell: ({ row }) => {
          const role = row.original.role ?? defaultAuthRole;

          return (
            <div className="flex flex-col items-start gap-1.5">
              <span className="rounded-full border border-primary/20 bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">{roleLabels[role]}</span>
              <span className="text-xs text-muted-foreground">
                {rolePermissionSummary[role]}
              </span>
            </div>
          );
        },
        header: "Rol actual",
        id: "role",
      },
      {
        cell: ({ row }) => {
          const role = row.original.role ?? defaultAuthRole;

          return (
            <Select
              disabled={isRolePending}
              onValueChange={(nextRole) =>
                handleRoleChange(row.original.id, nextRole as AuthRole)
              }
              value={role}
            >
              <SelectTrigger aria-label={`Rol de ${row.original.name}`} className="w-full min-w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {authRoleNames.map((roleName) => (
                    <SelectItem key={roleName} value={roleName}>
                      {roleLabels[roleName]}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          );
        },
        header: "Cambiar rol",
        id: "actions",
      },
    ],
    [handleRoleChange, isRolePending],
  );

  // TanStack Table intentionally returns table functions; this is the supported hook API.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    columns,
    data: filteredUsers,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    globalFilterFn: "includesString",
    onGlobalFilterChange: setGlobalFilter,
    onPaginationChange: setPagination,
    onSortingChange: setSorting,
    state: {
      globalFilter,
      pagination,
      sorting,
    },
  });

  return (
    <div className="w-full">
      <Card className="gap-0 overflow-hidden rounded-xl border bg-card shadow-sm" size="sm">
        <CardHeader className="border-b bg-muted/15 px-5 py-5 sm:px-6">
          <CardDescription className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary"><UsersRoundIcon className="size-4" /> Directorio de usuarios</CardDescription>
          <CardTitle className="text-lg">Usuarios y roles <span className="ml-2 rounded-full border bg-background px-2.5 py-0.5 text-xs font-medium text-muted-foreground">{users.length}</span></CardTitle>
          <CardDescription>Consulta los accesos y administra el rol de cada persona.</CardDescription>
          <CardAction>
            <Dialog
              open={inviteOpen}
              onOpenChange={(open) => {
                setInviteOpen(open);
                if (!open) {
                  setInviteError("");
                  setTemporaryPassword("");
                  setInviteEmail("");
                  setInviteRole("docente-investigador");
                  resetInviteErrors();
                }
              }}
            >
              <DialogTrigger asChild>
                <Button>
                  <MailPlusIcon aria-hidden="true" data-icon="inline-start" />
                  Invitar usuario
                </Button>
              </DialogTrigger>
              <DialogContent className="gap-0 overflow-hidden rounded-xl p-0 sm:max-w-lg">
                <DialogHeader className="border-b bg-muted/15 px-6 py-5 pr-14">
                  <span className="mb-2 flex size-10 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary"><MailPlusIcon className="size-5" aria-hidden="true" /></span>
                  <DialogTitle className="text-xl">Invitar usuario</DialogTitle>
                  <DialogDescription className="leading-6">
                    Define el correo y el rol inicial. Al invitar, se generará una contraseña temporal para compartir de forma segura.
                  </DialogDescription>
                </DialogHeader>

                <form
                  className="flex flex-col gap-6 px-6 py-6"
                  id="invite-user-form"
                  noValidate
                  onBlurCapture={onInviteBlur}
                  onSubmit={handleInvite}
                >
                  <FieldGroup className="gap-5">
                    <Field data-invalid={Boolean(inviteFieldErrors.email)}>
                      <FieldLabel htmlFor="invite-email">Correo electrónico</FieldLabel>
                      <Input
                        autoComplete="email"
                        aria-describedby={inviteFieldErrors.email ? "invite-email-error" : undefined}
                        aria-invalid={Boolean(inviteFieldErrors.email)}
                        id="invite-email"
                        name="email"
                        onChange={(event) => setInviteEmail(event.target.value)}
                        placeholder="nombre@institucion.com"
                        required
                        type="email"
                        value={inviteEmail}
                      />
                      <FieldError id="invite-email-error">{inviteFieldErrors.email}</FieldError>
                    </Field>
                    <Field data-invalid={Boolean(inviteError || inviteFieldErrors.role)}>
                      <FieldLabel htmlFor="invite-role">Rol inicial</FieldLabel>
                      <Select name="role" onValueChange={(value) => setInviteRole(value as AuthRole)} value={inviteRole}>
                        <SelectTrigger aria-describedby={inviteError || inviteFieldErrors.role ? "invite-role-error" : undefined} aria-invalid={Boolean(inviteError || inviteFieldErrors.role)} id="invite-role">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            {authRoleNames.map((roleName) => (
                              <SelectItem key={roleName} value={roleName}>
                                {roleLabels[roleName]}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                      <FieldError id="invite-role-error">{inviteFieldErrors.role ?? inviteError}</FieldError>
                      <p className="text-xs text-muted-foreground">El rol determina las secciones a las que podrá acceder.</p>
                    </Field>
                  </FieldGroup>

                  {temporaryPassword ? (
                    <div className="flex flex-col gap-2 rounded-lg border border-primary/20 bg-primary/5 p-4">
                      <span className="text-sm font-medium">
                        Contraseña temporal
                      </span>
                      <div className="flex items-center gap-2">
                        <code className="min-w-0 flex-1 truncate rounded-md border bg-background px-3 py-2 text-sm">
                          {temporaryPassword}
                        </code>
                        <Button
                          onClick={() => {
                            void navigator.clipboard.writeText(temporaryPassword);
                            toast.success("Contraseña copiada.");
                          }}
                          size="icon-sm"
                          type="button"
                          variant="outline"
                        >
                          <CopyIcon aria-hidden="true" />
                          <span className="sr-only">
                            Copiar contraseña temporal
                          </span>
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Esta contraseña no se volverá a mostrar al cerrar la ventana.
                      </p>
                    </div>
                  ) : null}
                </form>

                <DialogFooter className="border-t bg-muted/10 px-6 py-4">
                  <Button
                    disabled={isInvitePending}
                    form="invite-user-form"
                    type="submit"
                  >
                    {isInvitePending ? (
                      <Loader2Icon
                        aria-hidden="true"
                        className="animate-spin"
                        data-icon="inline-start"
                      />
                    ) : (
                      <MailPlusIcon
                        aria-hidden="true"
                        data-icon="inline-start"
                      />
                    )}
                    Invitar
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-0 p-0">
          <div className="flex flex-col gap-3 border-b px-5 py-4 md:flex-row md:items-center md:justify-between sm:px-6">
            <div className="relative w-full md:max-w-md">
              <SearchIcon
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                aria-label="Buscar usuarios por nombre o correo"
                className="pl-9"
                onChange={(event) => setGlobalFilter(event.target.value)}
                placeholder="Buscar por nombre o correo"
                value={globalFilter}
              />
            </div>
            <Select
              onValueChange={(value) => setRoleFilter(value as AuthRole | "all")}
              value={roleFilter}
            >
              <SelectTrigger aria-label="Filtrar usuarios por rol" className="w-full md:w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="all">Todos los roles</SelectItem>
                  {authRoleNames.map((roleName) => (
                    <SelectItem key={roleName} value={roleName}>
                      {roleLabels[roleName]}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          <div className="overflow-x-auto">
              <Table className="min-w-[850px]">
                <TableHeader className="bg-muted/20 text-xs">
                  {table.getHeaderGroups().map((headerGroup) => (
                    <TableRow key={headerGroup.id}>
                      {headerGroup.headers.map((header) => (
                        <TableHead className="first:pl-6 last:pr-6" key={header.id}>
                          {header.isPlaceholder
                            ? null
                            : flexRender(
                                header.column.columnDef.header,
                                header.getContext(),
                              )}
                        </TableHead>
                      ))}
                    </TableRow>
                  ))}
                </TableHeader>
                <TableBody>
                  {table.getRowModel().rows.length > 0 ? (
                    table.getPaginationRowModel().rows.map((row) => (
                      <TableRow className="odd:bg-muted/5 hover:bg-primary/5" key={row.id}>
                        {row.getVisibleCells().map((cell) => (
                          <TableCell className="py-4 first:pl-6 last:pr-6" key={cell.id}>
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext(),
                            )}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell
                        className="h-24 text-center text-muted-foreground"
                        colSpan={columns.length}
                      >
                        No hay usuarios que coincidan con el filtro.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
          </div>

          <div className="flex flex-col gap-3 border-t bg-muted/10 px-5 py-4 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between sm:px-6">
            <span aria-live="polite">
              {table.getFilteredRowModel().rows.length === 0
                ? "No hay usuarios para mostrar"
                : `Mostrando ${table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1}–${Math.min((table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize, table.getFilteredRowModel().rows.length)} de ${table.getFilteredRowModel().rows.length} usuarios`}
            </span>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Select
                onValueChange={(value) => table.setPageSize(Number(value))}
                value={`${table.getState().pagination.pageSize}`}
              >
                <SelectTrigger aria-label="Usuarios por página" className="w-full sm:w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {[10, 20, 50].map((pageSize) => (
                      <SelectItem key={pageSize} value={`${pageSize}`}>
                        {pageSize} por página
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <nav aria-label="Paginación de usuarios" className="flex flex-wrap items-center gap-1.5">
                <Button
                  aria-label="Página anterior"
                  disabled={!table.getCanPreviousPage()}
                  onClick={() => table.previousPage()}
                  size="sm"
                  variant="outline"
                >
                  <ChevronLeftIcon data-icon="inline-start" /> Anterior
                </Button>
                {Array.from({ length: table.getPageCount() }, (_, index) => index)
                  .filter((index) => Math.abs(index - table.getState().pagination.pageIndex) <= 2)
                  .map((index) => (
                    <Button
                      aria-current={index === table.getState().pagination.pageIndex ? "page" : undefined}
                      aria-label={`Página ${index + 1}`}
                      className="min-w-9 tabular-nums"
                      key={index}
                      onClick={() => table.setPageIndex(index)}
                      size="sm"
                      variant={index === table.getState().pagination.pageIndex ? "default" : "outline"}
                    >
                      {index + 1}
                    </Button>
                  ))}
                <Button
                  aria-label="Página siguiente"
                  disabled={!table.getCanNextPage()}
                  onClick={() => table.nextPage()}
                  size="sm"
                  variant="outline"
                >
                  Siguiente <ChevronRightIcon data-icon="inline-end" />
                </Button>
              </nav>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function formatProviders(providers: string[]) {
  if (providers.length === 0) {
    return "Sin accesos vinculados";
  }

  return providers
    .map((provider) => providerLabels[provider] ?? provider)
    .join(", ");
}
