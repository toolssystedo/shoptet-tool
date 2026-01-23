"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Users,
  Settings,
  ChevronLeft,
  Menu,
  Mail,
  UserCog,
  LogOut,
  Sparkles,
  Link2,
  Search,
  FileSearch,
  FolderTree,
  PanelTop,
} from "lucide-react";
import { Link, usePathname } from "@/i18n/routing";
import { useSidebar } from "@/lib/stores/sidebar-store";
import { useSession, signOut } from "next-auth/react";
import { Role } from "@prisma/client";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageSwitcherCompact } from "@/components/language-switcher";
import { useTranslations } from "next-intl";

interface NavItem {
  titleKey: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  requiredRole?: Role;
}

const navItems: NavItem[] = [
  {
    titleKey: "nav.dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    titleKey: "nav.enrichment",
    href: "/dashboard/enrichment",
    icon: Sparkles,
  },
  {
    titleKey: "nav.produkty",
    href: "/dashboard/produkty",
    icon: Link2,
  },
  {
    titleKey: "nav.siteAudit",
    href: "/dashboard/site-audit",
    icon: Search,
  },
  {
    titleKey: "nav.contentAudit",
    href: "/dashboard/content-audit",
    icon: FileSearch,
  },
  {
    titleKey: "nav.categoryMapper",
    href: "/dashboard/category-mapper",
    icon: FolderTree,
  },
  {
    titleKey: "nav.bannerGenerator",
    href: "/dashboard/banner-generator",
    icon: PanelTop,
  },
  {
    titleKey: "nav.profile",
    href: "/dashboard/profile",
    icon: UserCog,
  },
  {
    titleKey: "nav.userManagement",
    href: "/admin/users",
    icon: Users,
    requiredRole: "ADMIN",
  },
  {
    titleKey: "nav.invitations",
    href: "/admin/invitations",
    icon: Mail,
    requiredRole: "ADMIN",
  },
  {
    titleKey: "nav.settings",
    href: "/dashboard/settings",
    icon: Settings,
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { isCollapsed, toggle, setCollapsed } = useSidebar();
  const { data: session } = useSession();
  const t = useTranslations();

  const filteredNavItems = navItems.filter((item) => {
    if (!item.requiredRole) return true;
    return session?.user?.role === item.requiredRole;
  });

  return (
    <>
      {/* Mobile backdrop */}
      {!isCollapsed && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setCollapsed(true)}
        />
      )}
      
      <aside
        className={cn(
          "fixed left-0 top-0 h-screen bg-card border-r transition-all duration-300 z-50",
          // Desktop behavior
          "lg:translate-x-0",
          // Mobile behavior
          isCollapsed ? "-translate-x-full lg:translate-x-0 lg:w-16" : "translate-x-0 w-72"
        )}
      >
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="flex h-16 items-center justify-between px-4 border-b">
            {!isCollapsed && (
              <h2 className="text-lg font-semibold">Internal Tool</h2>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={toggle}
              className={cn(isCollapsed && "mx-auto")}
            >
              {isCollapsed ? (
                <Menu className="h-5 w-5" />
              ) : (
                <ChevronLeft className="h-5 w-5" />
              )}
            </Button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1 p-2 overflow-y-auto">
            {filteredNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;

              return (
                <Link key={item.href} href={item.href}>
                  <Button
                    variant={isActive ? "secondary" : "ghost"}
                    className={cn(
                      "w-full justify-start",
                      isCollapsed && "justify-center px-2"
                    )}
                  >
                    <Icon className={cn("h-5 w-5", !isCollapsed && "mr-3")} />
                    {!isCollapsed && <span>{t(item.titleKey)}</span>}
                  </Button>
                </Link>
              );
            })}
          </nav>

          {/* User section */}
          {session?.user && (
            <div className="border-t p-2">
              <div
                className={cn(
                  "flex items-center gap-3 p-2 rounded-lg",
                  isCollapsed && "justify-center"
                )}
              >
                {!isCollapsed ? (
                  <>
                    <div className="flex-1 truncate">
                      <p className="text-sm font-medium truncate">
                        {session.user.name}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {session.user.email}
                      </p>
                    </div>
                    <LanguageSwitcherCompact />
                    <ThemeToggle />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => signOut()}
                    >
                      <LogOut className="h-4 w-4" />
                    </Button>
                  </>
                ) : (
                  <div className="flex flex-col gap-2">
                    <LanguageSwitcherCompact />
                    <ThemeToggle />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => signOut()}
                    >
                      <LogOut className="h-5 w-5" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}