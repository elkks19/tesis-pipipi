"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ActivityIcon,
  ClipboardListIcon,
  LogOutIcon,
  TrendingUpIcon,
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

type DocenteStationSidebarProps = {
  activityHref?: string;
  basePath: string;
  performanceHref?: string;
  primaryHref?: string;
  primaryLabel: string;
  showActivity?: boolean;
  showPerformance?: boolean;
  subtitle: string;
  title: string;
};

function isNavItemActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function isExactNavItemActive(pathname: string, href: string) {
  return pathname === href;
}

export function DocenteStationSidebar({
  activityHref,
  basePath,
  performanceHref,
  primaryHref,
  primaryLabel,
  showActivity = true,
  showPerformance = true,
  subtitle,
  title,
}: DocenteStationSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { isMobile, setOpenMobile } = useSidebar();
  const { data: session, isPending } = useHydratedSession();
  const userName = session?.user.name ?? "Usuario";
  const userEmail = session?.user.email ?? "Sin sesion activa";
  const userImage = session?.user.image ?? undefined;
  const initials = getInitials(userName);
  const resolvedPrimaryHref = primaryHref ?? basePath;
  const resolvedActivityHref = activityHref ?? `${basePath}/actividad`;
  const resolvedPerformanceHref = performanceHref ?? `${basePath}/rendimiento`;
  const navItems = [
    {
      href: resolvedPrimaryHref,
      icon: ClipboardListIcon,
      label: primaryLabel,
    },
    ...(showActivity
      ? [
          {
            exact: true,
            href: resolvedActivityHref,
            icon: ActivityIcon,
            label: "Actividad",
          },
        ]
      : []),
    ...(showPerformance
      ? [
          {
            exact: true,
            href: resolvedPerformanceHref,
            icon: TrendingUpIcon,
            label: "Rendimiento",
          },
        ]
      : []),
  ];

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
            <SidebarMenuButton size="lg" tooltip={title}>
              <div className="flex min-w-0 flex-col">
                <span className="truncate font-semibold">{title}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {subtitle}
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Docencia</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const isActive = item.exact
                  ? isExactNavItemActive(pathname, item.href)
                  : isNavItemActive(pathname, item.href);
                const Icon = item.icon;

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
