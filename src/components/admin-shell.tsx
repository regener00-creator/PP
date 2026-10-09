import Link from "next/link";
import type { ReactNode } from "react";
import { AdminNav } from "./admin-nav";
import { InstallAppButton } from "./install-app";
import { logout } from "@/app/login/actions";
export function AdminShell({ children }: { children: ReactNode }) {
  return (
    <div className="admin-shell">
      <aside className="sidebar">
        <Link className="brand" href="/admin">
          <span className="mark">
            pp<span>•</span>
          </span>
          <span>
            น้องโจอา<small>เลขาส่วนตัว</small>
          </span>
        </Link>
        <AdminNav />
        <div className="sidebar-bottom">
          <InstallAppButton className="secondary" />
          <form action={logout}>
            <button className="secondary">ออกจากระบบ</button>
          </form>
        </div>
      </aside>
      <main className="dashboard">{children}</main>
    </div>
  );
}
