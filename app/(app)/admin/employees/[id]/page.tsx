"use client";

import Link from "next/link";
import { useState } from "react";
import { useParams } from "next/navigation";
import { canManage, useApp } from "@/lib/store";
import { LEAVE_LABEL, paidLeaveBalance } from "@/lib/calc";
import { formatDateJa } from "@/lib/date";
import Timesheet from "@/components/Timesheet";
import EmployeeModal from "@/components/EmployeeModal";
import { Avatar, RequestBadge, RoleBadge } from "@/components/ui";
import { IconChevronLeft, IconEdit } from "@/components/Icons";

export default function EmployeeDetailPage() {
  const params = useParams<{ id: string }>();
  const { db, user } = useApp();
  const [editing, setEditing] = useState(false);
  const emp = db.employees.find((e) => e.id === params.id);

  if (!emp || !canManage(user, emp)) {
    return (
      <div className="card card-body empty">
        従業員が見つからないか、閲覧権限がありません。
        <div className="mt-16"><Link className="btn" href="/admin/employees">従業員一覧へ</Link></div>
      </div>
    );
  }

  const dept = db.departments.find((d) => d.id === emp.departmentId);
  const bal = paidLeaveBalance(db, emp);
  const leaves = db.leaves.filter((l) => l.employeeId === emp.id && l.status !== "canceled").slice(0, 5);

  return (
    <>
      <div className="row mb-16">
        <Link href="/admin/employees" className="btn btn-sm btn-ghost"><IconChevronLeft size={15} /> 従業員一覧</Link>
      </div>
      <div className="card card-body mb-16">
        <div className="row" style={{ gap: 16 }}>
          <Avatar emp={emp} size="lg" />
          <div>
            <div className="row">
              <h1 style={{ fontSize: 20 }}>{emp.name}</h1>
              <span className="muted small">{emp.kana}</span>
              <RoleBadge role={emp.role} />
              {!emp.active && <span className="badge b-gray">退職</span>}
            </div>
            <div className="text-2 small">
              {emp.code}　{dept?.name} / {emp.position}　入社日 {emp.joinDate}　{emp.email}
            </div>
          </div>
          <span className="spacer" />
          <div className="center" style={{ padding: "0 12px" }}>
            <div className="small text-2">有給残</div>
            <div className="stat-value" style={{ color: "#10b4a4" }}>{bal.remaining}<small>/ {bal.granted}日</small></div>
          </div>
          {user.role === "admin" && (
            <button className="btn" onClick={() => setEditing(true)}><IconEdit size={15} /> 従業員情報を編集</button>
          )}
        </div>
        {leaves.length > 0 && (
          <div className="row mt-16 small" style={{ gap: 12 }}>
            <span className="text-2 bold">休暇申請:</span>
            {leaves.map((l) => (
              <span key={l.id} className="row" style={{ gap: 4 }}>
                {LEAVE_LABEL[l.type]} {formatDateJa(l.startDate, false)}
                <RequestBadge status={l.status} />
              </span>
            ))}
          </div>
        )}
      </div>

      <Timesheet employee={emp} mode="admin" />
      {editing && <EmployeeModal emp={emp} onClose={() => setEditing(false)} />}
    </>
  );
}
