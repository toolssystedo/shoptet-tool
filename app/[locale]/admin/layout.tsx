import { DashboardLayoutClient } from "@/components/layout/dashboard-layout-client";
import { MobileHeader } from "@/components/layout/mobile-header";
import { Sidebar } from "@/components/layout/sidebar";
import { ReactNode } from "react";

function layout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <MobileHeader />
      <DashboardLayoutClient>{children}</DashboardLayoutClient>
    </div>
  );
}

export default layout;
