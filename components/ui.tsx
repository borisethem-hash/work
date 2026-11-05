"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { Employee, RequestStatus } from "@/lib/types";
import { STATUS_LABEL, type DayResult, type DayStatus } from "@/lib/calc";
import { addMonths, formatMonthJa } from "@/lib/date";
import { IconCheckCircle, IconAlert, IconChevronLeft, IconChevronRight, IconX } from "./Icons";

export function Avatar({ emp, size }: { emp: Pick<Employee, "name" | "color">; size?: "lg" }) {
  const initial = emp.name.replace(/\s/g, "").slice(0, 1);
  return (
    <span className={`avatar ${size ?? ""}`} style={{ background: emp.color }}>
      {initial}
    </span>
  );
}

export function Person({ emp, sub }: { emp: Employee; sub?: React.ReactNode }) {
  return (
    <div className="person">
      <Avatar emp={emp} />
      <div>
        <div className="name">{emp.name}</div>
        {sub != null && <div className="sub">{sub}</div>}
      </div>
    </div>
  );
}

const STATUS_CLASS: Record<DayStatus, string> = {
  work: "b-blue",
  working: "b-green",
  break: "b-orange",
  leave: "b-violet",
  absent: "b-red",
  holiday: "b-gray",
  holiday_work: "b-teal",
  missing_out: "b-red",
  not_yet: "b-gray",
  future: "b-gray",
};

export function DayStatusBadge({ day }: { day: DayResult }) {
  if (day.status === "future" && !day.pendingLeave) return null;
  if (day.status === "future" && day.pendingLeave) return <span className="badge b-orange">休暇申請中</span>;
  let label = STATUS_LABEL[day.status];
  if (day.status === "leave" && day.leave) {
    label = { paid_full: "有休", paid_am: "午前休", paid_pm: "午後休", special: "特休", substitute: "振休", unpaid: "欠勤(届)" }[day.leave.type];
  }
  if (day.status === "holiday" && day.holidayName) label = day.holidayName;
  return <span className={`badge ${STATUS_CLASS[day.status]}`}>{label}</span>;
}

export function RequestBadge({ status }: { status: RequestStatus }) {
  const map: Record<RequestStatus, [string, string]> = {
    pending: ["承認待ち", "b-orange"],
    approved: ["承認済", "b-green"],
    rejected: ["却下", "b-red"],
    canceled: ["取消", "b-gray"],
  };
  const [label, cls] = map[status];
  return <span className={`badge ${cls}`}>{label}</span>;
}

export function RoleBadge({ role }: { role: Employee["role"] }) {
  if (role === "admin") return <span className="badge b-violet">管理者</span>;
  if (role === "manager") return <span className="badge b-teal">マネージャー</span>;
  return <span className="badge b-gray">一般</span>;
}

export function MonthNav({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="month-nav">
      <button className="btn btn-ghost" onClick={() => onChange(addMonths(value, -1))} aria-label="前月">
        <IconChevronLeft />
      </button>
      <span>{formatMonthJa(value)}</span>
      <button className="btn btn-ghost" onClick={() => onChange(addMonths(value, 1))} aria-label="翌月">
        <IconChevronRight />
      </button>
    </div>
  );
}

export function Modal({
  title,
  onClose,
  children,
  footer,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="modal-bg" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? "wide" : ""}`} role="dialog" aria-modal="true">
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="閉じる">
            <IconX />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

type Toast = { id: number; message: string; error?: boolean };
const ToastCtx = createContext<(message: string, error?: boolean) => void>(() => {});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((message: string, error?: boolean) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, error }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.error ? "error" : ""}`}>
            {t.error ? <IconAlert /> : <IconCheckCircle />}
            {t.message}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  return useContext(ToastCtx);
}

export function Stat({
  label,
  value,
  unit,
  sub,
  color,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  unit?: string;
  sub?: React.ReactNode;
  color?: string;
}) {
  return (
    <div className="card stat">
      <div className="stat-label">
        {color && <span className="dot" style={{ background: color }} />}
        {label}
      </div>
      <div className="stat-value" style={color ? { color } : undefined}>
        {value}
        {unit && <small>{unit}</small>}
      </div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="empty">{children}</div>;
}
