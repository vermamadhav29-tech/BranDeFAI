import DashboardShell from "@/components/layout/DashboardShell";
import Sidebar from "@/components/layout/Sidebar";
import TopBar from "@/components/layout/TopBar";
import MobileNav from "@/components/layout/MobileNav";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardShell>
      <Sidebar />
      <div className="bd-main">
        <TopBar />
        <main className="bd-page">{children}</main>
      </div>
      <MobileNav />
    </DashboardShell>
  );
}
