"use client";

import { useSidebar } from "@/lib/stores/sidebar-store";
import { cn } from "@/lib/utils";

export function DashboardLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isCollapsed } = useSidebar();

  return (
    <main 
      className={cn(
        "flex-1 transition-all duration-300",
        // Desktop: always has margin based on sidebar state
        "lg:ml-16",
        !isCollapsed && "lg:ml-64",
        // Mobile: no margin when sidebar is hidden, but account for header
        "ml-0 pt-16 lg:pt-0"
      )}
    >
      <div className="container mx-auto p-6">
        {children}
      </div>
    </main>
  );
}