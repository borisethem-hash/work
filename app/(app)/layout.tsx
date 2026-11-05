"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useNow, useStore, visibleEmployees } from "@/lib/store";
import { Avatar, RoleBadge } from "@/components/ui";
import {
  IconCalendar,
  IconChart,
  IconCheckCircle,
  IconDoc,
  IconHome,
  IconLogout,
  IconMenu,
  IconSettings,
  IconUsers,
  IconBuilding,
} from "@/components/Icons";
import { formatDateJa, pad, todayStr } from "@/lib/date";

const TITLES: [string, string][] = [
  ["/dashboard", "マイページ"],
  ["/timesheet", "勤怠一覧"],
  ["/requests", "申請"],
  ["/admin/attendance", "勤怠集計"],
  ["/admin/approvals", "承認"],
  ["/admin/employees", "従業員管理"],
  ["/admin/settings", "設定"],
  ["/admin", "管理ダッシュボード"],
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const store = useStore();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const now = useNow(30000);

  useEffect(() => {
    if (store && !store.user) router.replace("/login");
  }, [store, router]);

  useEffect(() => setOpen(false), [pathname]);

  const user = store?.user;
  const isManager = user?.role === "admin" || user?.role === "manager";
  const isAdmin = user?.role === "admin";

  const isAdminPath = pathname.startsWith("/admin");
  const isAdminOnly = pathname.startsWith("/admin/settings");
  const forbidden = !!user && ((isAdminPath && !isManager) || (isAdminOnly && !isAdmin));

  const pending = useMemo(() => {
    if (!store?.user || !isManager) return 0;
    const ids = new Set(visibleEmployees(store.db, store.user).map((e) => e.id));
    return (
      store.db.leaves.filter((l) => l.status === "pending" && ids.has(l.employeeId) && l.employeeId !== store.user!.id).length +
      store.db.corrections.filter((c) => c.status === "pending" && ids.has(c.employeeId) && c.employeeId !== store.user!.id).length
    );
  }, [store, isManager]);

  if (!store || !user) {
    return (
      <div className="loading">
        <div>
          <div className="spinner" />
          読み込み中…
        </div>
      </div>
    );
  }

  const dept = store.db.departments.find((d) => d.id === user.departmentId);
  const title = TITLES.find(([p]) => pathname === p || pathname.startsWith(p + "/"))?.[1] ?? "";
  const nav = (href: string, label: string, icon: React.ReactNode, count?: number) => {
    const active = href === "/admin" ? pathname === "/admin" : pathname === href || pathname.startsWith(href + "/");
    return (
      <Link href={href} className={active ? "active" : ""}>
        {icon}
        {label}
        {!!count && <span className="count">{count}</span>}
      </Link>
    );
  };

  return (
    <div className="shell">
      <aside className={`sidebar ${open ? "open" : ""}`}>
        <div className="brand">
          <div className="brand-mark">K</div>
          <div>
            <div className="brand-name">KinTrack</div>
            <div className="brand-sub">{store.db.settings.companyName}</div>
          </div>
        </div>
        <nav className="nav">
          <div className="nav-section">マイメニュー</div>
          {nav("/dashboard", "打刻・マイページ", <IconHome />)}
          {nav("/timesheet", "勤怠一覧", <IconCalendar />)}
          {nav("/requests", "休暇・修正申請", <IconDoc />)}
          {isManager && (
            <>
              <div className="nav-section">管理メニュー{user.role === "manager" ? `（${dept?.name ?? ""}）` : ""}</div>
              {nav("/admin", "勤怠状況", <IconBuilding />)}
              {nav("/admin/attendance", "月次集計・CSV", <IconChart />)}
              {nav("/admin/approvals", "承認", <IconCheckCircle />, pending)}
              {nav("/admin/employees", "従業員", <IconUsers />)}
            </>
          )}
          {isAdmin && nav("/admin/settings", "設定", <IconSettings />)}
        </nav>
        <div className="sidebar-foot">
          <div className="sidebar-user">
            <Avatar emp={user} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="bold" style={{ fontSize: 13 }}>{user.name}</div>
              <small>{dept?.name} / {user.position}</small>
            </div>
            <button
              className="btn btn-ghost btn-icon"
              style={{ color: "#c3cfe2" }}
              title="ログアウト"
              onClick={() => {
                store.logout();
                router.replace("/login");
              }}
            >
              <IconLogout />
            </button>
          </div>
        </div>
      </aside>
      <div className={`overlay ${open ? "show" : ""}`} onClick={() => setOpen(false)} />
      <div className="main">
        <header className="topbar">
          <button className="btn btn-ghost btn-icon menu-btn" onClick={() => setOpen(true)} aria-label="メニュー">
            <IconMenu />
          </button>
          <div className="topbar-title">{title}</div>
          <div className="topbar-right">
            <span className="hide-sm small">
              {formatDateJa(todayStr())} {pad(now.getHours())}:{pad(now.getMinutes())}
            </span>
            <RoleBadge role={user.role} />
          </div>
        </header>
        <main className="content">
          {forbidden ? (
            <div className="card card-body empty">
              このページを表示する権限がありません。
              <div className="mt-16">
                <Link href="/dashboard" className="btn btn-primary">マイページへ戻る</Link>
              </div>
            </div>
          ) : (
            children
          )}
        </main>
      </div>
    </div>
  );
}
