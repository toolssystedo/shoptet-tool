import { Sidebar } from "@/components/layout/sidebar";
import { DashboardLayoutClient } from "@/components/layout/dashboard-layout-client";
import { MobileHeader } from "@/components/layout/mobile-header";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/auth/signin");
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <MobileHeader />
      <DashboardLayoutClient>
        {children}
      </DashboardLayoutClient>
    </div>
  );
}