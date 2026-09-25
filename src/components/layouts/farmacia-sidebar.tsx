"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ActivityIcon,
  LogOutIcon,
  PackagePlusIcon,
  PillIcon,
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
import { useHydratedSession } from "@/lib/use-hydrated-session";
import { SidebarThemeMenuItems } from "@/components/layouts/sidebar-theme-menu-items";

type NavItem = {
  href: string;
  icon: typeof PillIcon;
  label: string;
};

const activeNavItems: NavItem[] = [
  {
    href: "/estudiante/farmacia/inventario",
    icon: PillIcon,
    label: "Inventario",
  },
  {
    href: "/estudiante/farmacia/actividad",
    icon: ActivityIcon,
    label: "Actividad",
  },
];

const planningNavItems: NavItem[] = [
  {
    href: "/estudiante/farmacia/planeacion",
    icon: PackagePlusIcon,
    label: "Planeacion",
  },
];

function isNavItemActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

type FarmaciaSidebarProps = {
  accessPhase: "sin_acceso" | "planeacion" | "activo" | "conciliacion" | "cerrado";
};

export function FarmaciaSidebar({ accessPhase }: FarmaciaSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { isMobile, setOpenMobile } = useSidebar();
  const { data: session, isPending } = useHydratedSession();
  const userName = session?.user.name ?? "Usuario";
  const userEmail = session?.user.email ?? "Sin sesion activa";
  const userImage = session?.user.image ?? undefined;
  const initials = getInitials(userName);
  const tripActive = accessPhase === "activo";
  const navItems = accessPhase === "planeacion" ? planningNavItems : activeNavItems;

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
            <SidebarMenuButton size="lg" tooltip="Farmacia">
              <PillIcon />
              <div className="flex min-w-0 flex-col">
                <span className="truncate font-semibold">Farmacia</span>
                <span className="truncate text-xs text-muted-foreground">
                  {tripActive ? "Viaje activo" : accessPhase === "planeacion" ? "Planeacion" : "Consulta"}
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>
            {tripActive ? "Viaje" : accessPhase === "planeacion" ? "Preparacion" : "Historial"}
          </SidebarGroupLabel>
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
