"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ActivityIcon,
  ClipboardListIcon,
  LogOutIcon,
  UserRoundIcon,
} from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { authClient } from "@/lib/auth-client";
import { SidebarThemeMenuItems } from "@/components/layouts/sidebar-theme-menu-items";

const navItems = [
  {
    href: "/estudiante/laboratorios",
    icon: ClipboardListIcon,
    label: "Crear laboratorio",
  },
  {
    href: "/estudiante/laboratorios/actividad",
    icon: ActivityIcon,
    label: "Actividad",
  },
];

function isNavItemActive(pathname: string, href: string) {
  if (href === "/estudiante/laboratorios") {
    return (
      pathname === href ||
      (pathname.startsWith(`${href}/`) &&
        pathname !== "/estudiante/laboratorios/actividad")
    );
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function LaboratoriosSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { isMobile, setOpenMobile } = useSidebar();
  const { data: session, isPending } = authClient.useSession();
  const userName = session?.user.name ?? "Usuario";
  const userEmail = session?.user.email ?? "Sin sesion activa";
  const userImage = session?.user.image ?? undefined;
  const initials = getInitials(userName);

  function closeMobileSidebar() {
    if (isMobile) {
      setOpenMobile(false);
    }
  }

  return (
    <Sidebar collapsible="icon" variant="floating">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" tooltip="Laboratorios">
              <div className="flex min-w-0 flex-col">
                <span className="truncate font-semibold">Laboratorios</span>
                <span className="truncate text-xs text-muted-foreground">
                  Resultados
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Atencion</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = isNavItemActive(pathname, item.href);

                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.label}
                    >
                      <Link href={item.href} onClick={closeMobileSidebar}>
                        <Icon />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  className="group-data-[collapsible=icon]:rounded-full"
                  size="lg"
                  tooltip={userName}
                >
                  <Avatar size="sm">
                    <AvatarImage alt={userName} src={userImage} />
                    <AvatarFallback>
                      {isPending ? <UserRoundIcon /> : initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate font-medium">{userName}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {userEmail}
                    </span>
                  </div>
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" side="right">
                <DropdownMenuLabel>
                  <div className="flex min-w-0 flex-col gap-1">
                    <span className="truncate text-sm font-medium">
                      {userName}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {userEmail}
                    </span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <SidebarThemeMenuItems />
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem
                    disabled={!session}
                    onClick={async () => {
                      await authClient.signOut();
                      router.refresh();
                    }}
                    variant="destructive"
                  >
                    <LogOutIcon />
                    Cerrar sesion
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

function getInitials(name: string) {
  return (
    name
      .split(" ")
      .map((part) => part[0])
      .filter(Boolean)
      .join("")
      .slice(0, 2)
      .toUpperCase() || "U"
  );
}
