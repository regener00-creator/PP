"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";

const pages = [
  { href: "/admin", label: "ความทรงจำ" },
  { href: "/admin/files", label: "รูปและไฟล์" },
  { href: "/admin/settings", label: "สิทธิ์/เพื่อน/ประวัติ" },
];

function LinkLabel({ children }: { children: string }) {
  const { pending } = useLinkStatus();
  return (
    <span className="nav-label" data-pending={pending || undefined}>
      {children}
      <span className="nav-pending" aria-hidden="true" />
      {pending && (
        <span className="sr-only" role="status">
          กำลังเปิดหน้า
        </span>
      )}
    </span>
  );
}

function NavLink({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      prefetch={true}
    >
      <LinkLabel>{label}</LinkLabel>
    </Link>
  );
}

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="เมนูหลัก">
      {pages.map((page) => (
        <NavLink key={page.href} {...page} active={pathname === page.href} />
      ))}
    </nav>
  );
}
