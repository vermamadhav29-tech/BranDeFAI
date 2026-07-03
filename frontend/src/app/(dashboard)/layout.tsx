import DashboardShell from "@/components/layout/DashboardShell";
import Sidebar from "@/components/layout/Sidebar";
import TopBar from "@/components/layout/TopBar";
import MobileNav from "@/components/layout/MobileNav";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardShell>
      <div className="flex h-screen overflow-hidden" style={{ background: "var(--bg-base)" }}>
        <Sidebar />
        <div className="flex flex-col flex-1 overflow-hidden min-w-0">
          <TopBar />
          <main className="flex-1 overflow-y-auto p-6">{children}</main>
        </div>
      </div>
      <MobileNav />
    </DashboardShell>
  );
}
