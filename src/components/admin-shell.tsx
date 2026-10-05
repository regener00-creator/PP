import Link from "next/link";
import type {ReactNode} from "react";
import { AdminNav } from "./admin-nav";
import { InstallAppButton } from "./install-app";
import {logout} from "@/app/login/actions";
export function AdminShell({children,area="memory"}:{children:ReactNode;area?:"memory"|"planner"}){
  return <div className={`admin-shell ${area === "planner" ? "planner-shell" : ""}`}><aside className="sidebar"><Link className="brand" href="/workspace"><span className="mark">pp<span>•</span></span><span>PP <small>{area === "planner" ? "CONTENT PLANNER" : "MEMORY"}</small></span></Link><AdminNav area={area}/><div className="sidebar-bottom"><Link className="button secondary" href="/workspace">สลับพื้นที่</Link><InstallAppButton className="secondary"/><form action={logout}><button className="secondary">ออกจากระบบ</button></form></div></aside><main className="dashboard">{children}</main></div>;
}
