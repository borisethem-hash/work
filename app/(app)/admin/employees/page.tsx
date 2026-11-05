"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useApp, visibleEmployees } from "@/lib/store";
import { clockState, paidLeaveBalance } from "@/lib/calc";
import { todayStr } from "@/lib/date";
import type { Employee } from "@/lib/types";
import { Person, RoleBadge } from "@/components/ui";
import EmployeeModal from "@/components/EmployeeModal";
import { IconEdit, IconPlus, IconSearch } from "@/components/Icons";


export default function EmployeesPage() {
  const { db, user } = useApp();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [dept, setDept] = useState("all");
  const [showInactive, setShowInactive] = useState(false);
  const [editing, setEditing] = useState<Employee | "new" | null>(null);
  const today = todayStr();
  const isAdmin = user.role === "admin";

  const list = visibleEmployees(db, user)
    .filter((e) => (showInactive ? true : e.active))
    .filter((e) => dept === "all" || e.departmentId === dept)
    .filter((e) => !q || e.name.includes(q) || e.kana.includes(q) || e.code.toLowerCase().includes(q.toLowerCase()) || e.email.includes(q));

  const deptName = (id: string) => db.departments.find((d) => d.id === id)?.name ?? "";
  const stateLabel = { off: ["未出勤", "b-gray"], working: ["勤務中", "b-green"], break: ["休憩中", "b-orange"], done: ["退勤済", "b-blue"] } as const;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>従業員</h1>
          <p>従業員情報の確認{isAdmin && "・登録・編集"}と、個人別の勤怠明細へのアクセス</p>
        </div>
        {isAdmin && (
          <div className="actions">
            <button className="btn btn-primary" onClick={() => setEditing("new")}><IconPlus /> 従業員を登録</button>
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-head">
          <div className="row">
            <div style={{ position: "relative" }}>
              <IconSearch style={{ position: "absolute", left: 10, top: 10, color: "#8592a6" }} />
              <input className="input" style={{ paddingLeft: 34, width: 240 }} placeholder="氏名・カナ・社員番号・メール" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            {isAdmin && (
              <select className="select" style={{ width: 200 }} value={dept} onChange={(e) => setDept(e.target.value)}>
                <option value="all">全部署</option>
                {db.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            )}
            <label className="row small" style={{ gap: 6, cursor: "pointer" }}>
              <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} /> 退職者を含む
            </label>
          </div>
          <span className="right small muted">{list.length}名</span>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>従業員</th>
                <th>社員番号</th>
                <th>部署 / 役職</th>
                <th>権限</th>
                <th>入社日</th>
                <th className="r">有給残</th>
                <th>本日</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {list.map((e) => {
                const st = clockState(db.records.find((r) => r.employeeId === e.id && r.date === today));
                const bal = paidLeaveBalance(db, e);
                return (
                  <tr key={e.id} className="clickable" onClick={() => router.push(`/admin/employees/${e.id}`)} style={{ opacity: e.active ? 1 : 0.55 }}>
                    <td><Person emp={e} sub={e.email} /></td>
                    <td className="num">{e.code}</td>
                    <td>{deptName(e.departmentId)}<div className="small muted">{e.position}</div></td>
                    <td><RoleBadge role={e.role} /></td>
                    <td className="num">{e.joinDate}</td>
                    <td className="r">{bal.remaining} / {bal.granted}日</td>
                    <td>{e.active ? <span className={`badge ${stateLabel[st][1]}`}>{stateLabel[st][0]}</span> : <span className="badge b-gray">退職</span>}</td>
                    <td className="r" onClick={(ev) => ev.stopPropagation()}>
                      {isAdmin && (
                        <button className="btn btn-sm btn-ghost" onClick={() => setEditing(e)}><IconEdit size={15} /> 編集</button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {editing && <EmployeeModal emp={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </>
  );
}
