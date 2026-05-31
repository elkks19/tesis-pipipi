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
  ArrowUpDownIcon,
  CopyIcon,
  Loader2Icon,
  MailPlusIcon,
  SearchIcon,
} from "lucide-react";
import { toast } from "sonner";

import { inviteUser, updateUserRole } from "@/app/admin/actions";
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
  const [isRolePending, startRoleTransition] = useTransition();
  const [isInvitePending, startInviteTransition] = useTransition();

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
          <div className="flex min-w-0 flex-col gap-1">
            <span className="truncate font-medium">{row.original.name}</span>
            <span className="truncate text-sm text-muted-foreground">
              {row.original.email}
            </span>
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
            <div className="flex flex-col gap-1">
              <span className="font-medium">{roleLabels[role]}</span>
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
              <SelectTrigger aria-label={`Rol de ${row.original.name}`}>
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
    <div className="flex min-h-0 flex-1 flex-col">
      <Card className="min-h-0 flex-1" size="sm">
        <CardHeader>
          <CardDescription>{users.length} usuarios registrados</CardDescription>
          <CardTitle>Usuarios y roles</CardTitle>
          <CardAction>
            <Dialog
              open={inviteOpen}
              onOpenChange={(open) => {
                setInviteOpen(open);
                if (!open) {
                  setInviteError("");
                  setTemporaryPassword("");
                }
              }}
            >
              <DialogTrigger asChild>
                <Button>
                  <MailPlusIcon aria-hidden="true" data-icon="inline-start" />
                  Invitar
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Invitar usuario</DialogTitle>
                  <DialogDescription>
                    Crea una cuenta con correo y rol inicial. Se generara una
                    contraseña temporal para compartir por un canal seguro.
                  </DialogDescription>
                </DialogHeader>

                <form
                  className="flex flex-col gap-6"
                  id="invite-user-form"
                  onSubmit={handleInvite}
                >
                  <FieldGroup>
                    <Field data-invalid={Boolean(inviteError)}>
                      <FieldLabel htmlFor="invite-email">Correo</FieldLabel>
                      <Input
                        autoComplete="email"
                        id="invite-email"
                        name="email"
                        required
                        type="email"
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="invite-role">Rol inicial</FieldLabel>
                      <Select defaultValue="docente-investigador" name="role">
                        <SelectTrigger id="invite-role">
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
                      <FieldError>{inviteError}</FieldError>
                    </Field>
                  </FieldGroup>

                  {temporaryPassword ? (
                    <div className="flex flex-col gap-2 rounded-2xl bg-muted/50 p-3">
                      <span className="text-sm font-medium">
                        Contraseña temporal
                      </span>
                      <div className="flex items-center gap-2">
                        <code className="min-w-0 flex-1 truncate rounded-xl bg-background px-3 py-2 text-sm">
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
                        Este dato no se mostrara de nuevo al cerrar el modal.
                      </p>
                    </div>
                  ) : null}
                </form>

                <DialogFooter>
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
        <CardContent className="flex min-h-0 flex-1 flex-col gap-3">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div className="relative md:w-80">
              <SearchIcon
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <Input
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
              <SelectTrigger className="w-full md:w-64">
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

          <div className="min-h-0 flex-1 overflow-hidden rounded-lg border">
            <div className="h-full overflow-auto">
              <Table>
                <TableHeader>
                  {table.getHeaderGroups().map((headerGroup) => (
                    <TableRow key={headerGroup.id}>
                      {headerGroup.headers.map((header) => (
                        <TableHead key={header.id}>
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
                      <TableRow key={row.id}>
                        {row.getVisibleCells().map((cell) => (
                          <TableCell key={cell.id}>
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
          </div>

          <div className="flex flex-col gap-3 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
            <span>
              {table.getFilteredRowModel().rows.length} usuarios encontrados
            </span>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Select
                onValueChange={(value) => table.setPageSize(Number(value))}
                value={`${table.getState().pagination.pageSize}`}
              >
                <SelectTrigger className="w-full sm:w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {[10, 20, 50].map((pageSize) => (
                      <SelectItem key={pageSize} value={`${pageSize}`}>
                        {pageSize} por pagina
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <div className="flex items-center gap-2">
                <Button
                  disabled={!table.getCanPreviousPage()}
                  onClick={() => table.previousPage()}
                  variant="outline"
                >
                  Anterior
                </Button>
                <span className="min-w-24 text-center">
                  Pagina {table.getState().pagination.pageIndex + 1} de{" "}
                  {table.getPageCount() || 1}
                </span>
                <Button
                  disabled={!table.getCanNextPage()}
                  onClick={() => table.nextPage()}
                  variant="outline"
                >
                  Siguiente
                </Button>
              </div>
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
