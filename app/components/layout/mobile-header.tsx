"use client";

import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";
import { useSidebar } from "@/lib/stores/sidebar-store";

export function MobileHeader() {
  const { setCollapsed } = useSidebar();

  return (
    <header className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-card border-b z-30 flex items-center px-4">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setCollapsed(false)}
      >
        <Menu className="h-5 w-5" />
      </Button>
      <h1 className="ml-4 text-lg font-semibold">Internal Tool</h1>
    </header>
  );
}