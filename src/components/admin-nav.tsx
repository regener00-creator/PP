"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const pages = [
  { href: "/admin", label: "ความทรงจำ" },
  { href: "/admin/files", label: "รูปและไฟล์" },
  { href: "/admin/learning", label: "เรียนรู้จากกลุ่ม" },
  { href: "/admin/settings", label: "สิทธิ์/เพื่อน/ประวัติ" },
];

function LinkLabel({ children }: { children: string }) {
  const { pending } = useLinkStatus();
  return <span className="nav-label" data-pending={pending || undefined}>
    {children}<span className="nav-pending" aria-hidden="true"/>
    {pending && <span className="sr-only" role="status">กำลังเปิดหน้า</span>}
  </span>;
}

function NavLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  const [intent, setIntent] = useState(false);
  return <Link href={href} aria-current={active ? "page" : undefined}
    prefetch={intent ? true : null}
    onMouseEnter={() => setIntent(true)} onFocus={() => setIntent(true)}>
    <LinkLabel>{label}</LinkLabel>
  </Link>;
}

const plannerPages = [
 { href: "/planner", label: "ช่วยคิดคอนเทนต์" }, { href: "/planner/work", label: "งานและปฏิทิน" },
 { href: "/planner/brands", label: "ข้อมูลแบรนด์" }, { href: "/planner/files", label: "รูปและไฟล์" },
 { href: "/planner/overview", label: "ภาพรวมและผลลัพธ์" },
];
export function AdminNav({ area = "memory" }: { area?: "memory" | "planner" }) {
  const pathname = usePathname();
  return <nav aria-label="เมนูหลัก">{(area === "planner" ? plannerPages : pages).map(page =>
    <NavLink key={page.href} {...page} active={pathname === page.href}/>
  )}</nav>;
}
