"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useApp, visibleEmployees } from "@/lib/store";
import { buildRecordMap, evaluateDay, summarizeMonth, type DayStatus } from "@/lib/calc";
import { currentMonth, fmtDuration, fmtHours, formatDateJa, formatMD, formatMonthJa, todayStr } from "@/lib/date";
import { DayStatusBadge, Person, Stat } from "@/components/ui";
import { IconAlert, IconCheckCircle } from "@/components/Icons";

const GROUPS: { key: string; label: string; color: string; match: DayStatus[] }[] = [
  { key: "working", label: "勤務中", color: "#15975f", match: ["working"] },
  { key: "break", label: "休憩中", color: "#e3a21a", match: ["break"] },
  { key: "done", label: "退勤済", color: "#0f6fde", match: ["work", "holiday_work"] },
  { key: "leave", label: "休暇", color: "#7553db", match: ["leave"] },
  { key: "not_yet", label: "未出勤", color: "#b7c1cf", match: ["not_yet"] },
];

export default function AdminDashboard() {
  const { db, user } = useApp();
  const router = useRouter();
  const [dept, setDept] = useState(user.role === "manager" ? user.departmentId : "all");
  const today = todayStr();
  const ym = currentMonth();

  const scoped = visibleEmployees(db, user).filter((e) => e.active && (dept === "all" || e.departmentId === dept));
  const data = useMemo(() => {
    const map = buildRecordMap(db);
    return scoped.map((e) => ({
      emp: e,
      today: evaluateDay(db, e, today, map, today),
      month: summarizeMonth(db, e, ym, map),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, dept, user.id, today, ym]);

  const count = (g: (typeof GROUPS)[number]) => data.filter((d) => g.match.includes(d.today.status)).length;
  const offToday = data.length > 0 && data[0].today.offDay;
  const ids = new Set(scoped.map((e) => e.id));
  const pendingLeaves = db.leaves.filter((l) => l.status === "pending" && ids.has(l.employeeId) && l.employeeId !== user.id).length;
  const pendingCorr = db.corrections.filter((c) => c.status === "pending" && ids.has(c.employeeId) && c.employeeId !== user.id).length;
  const otLimit = db.settings.overtimeAlertHours * 60;

  const alerts: { emp: (typeof data)[number]["emp"]; text: string; level: "red" | "orange" }[] = [];
  for (const d of data) {
    const miss = d.month.days.filter((x) => x.status === "missing_out");
    if (miss.length) alerts.push({ emp: d.emp, text: `打刻漏れ ${miss.map((m) => formatMD(m.date)).join("、")}`, level: "red" });
    const abs = d.month.days.filter((x) => x.status === "absent");
    if (abs.length) alerts.push({ emp: d.emp, text: `欠勤 ${abs.map((m) => formatMD(m.date)).join("、")}`, level: "red" });
    if (d.month.overtimeMin > otLimit) alerts.push({ emp: d.emp, text: `今月の残業が ${fmtHours(d.month.overtimeMin)}h（基準 ${db.settings.overtimeAlertHours}h 超過）`, level: "orange" });
    if (d.today.lateMin > 0) alerts.push({ emp: d.emp, text: `本日 ${d.today.lateMin}分の遅刻`, level: "orange" });
  }

  const ranking = [...data].sort((a, b) => b.month.overtimeMin - a.month.overtimeMin).slice(0, 8);
  const maxOt = Math.max(otLimit, ...ranking.map((r) => r.month.overtimeMin), 1);
  const depts = db.departments.filter((d) => user.role === "admin" || d.id === user.departmentId);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>勤怠状況</h1>
          <p>{formatDateJa(today)} 現在のリアルタイム状況{offToday && "（本日は休日です）"}</p>
        </div>
        <div className="actions">
          {user.role === "admin" ? (
            <select className="select" style={{ width: 200 }} value={dept} onChange={(e) => setDept(e.target.value)}>
              <option value="all">全部署</option>
              {db.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          ) : (
            <span className="badge b-teal" style={{ fontSize: 13, padding: "4px 12px" }}>{depts[0]?.name}</span>
          )}
        </div>
      </div>

      <div className="grid g-6 mb-16">
        <Stat label="在籍" value={data.length} unit="名" />
        {GROUPS.map((g) => <Stat key={g.key} label={g.label} value={count(g)} unit="名" color={g.color} />)}
      </div>

      <div className="grid g-main mb-16">
        <div className="card">
          <div className="card-head">
            <h2>本日の出勤状況</h2>
            <div className="right legend">
              {GROUPS.map((g) => <span key={g.key}><i style={{ background: g.color }} />{g.label}</span>)}
            </div>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>従業員</th>
                  <th>状態</th>
                  <th className="c">出勤</th>
                  <th className="c">退勤</th>
                  <th className="r">本日労働</th>
                  <th className="r">今月残業</th>
                </tr>
              </thead>
              <tbody>
                {data.map(({ emp, today: t, month }) => (
                  <tr key={emp.id} className="clickable" onClick={() => router.push(`/admin/employees/${emp.id}`)}>
                    <td><Person emp={emp} sub={`${db.departments.find((d) => d.id === emp.departmentId)?.name} / ${emp.position}`} /></td>
                    <td>
                      <div className="row" style={{ gap: 4 }}>
                        <DayStatusBadge day={t} />
                        {t.lateMin > 0 && <span className="badge b-orange">遅刻</span>}
                      </div>
                    </td>
                    <td className="c num">{t.record?.clockIn ?? "-"}</td>
                    <td className="c num">{t.record?.clockOut ?? "-"}</td>
                    <td className="r">{fmtDuration(t.workMin)}</td>
                    <td className={`r ${month.overtimeMin > otLimit ? "warn-text" : ""}`}>{fmtHours(month.overtimeMin)}h</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="grid" style={{ alignContent: "start" }}>
          <div className="card">
            <div className="card-head">
              <h2>承認待ち</h2>
              <div className="right"><Link href="/admin/approvals" className="btn btn-sm">承認画面へ</Link></div>
            </div>
            <div className="card-body grid g-2">
              <div>
                <div className="small text-2">休暇申請</div>
                <div className="stat-value" style={{ color: pendingLeaves ? "#c77a06" : undefined }}>{pendingLeaves}<small>件</small></div>
              </div>
              <div>
                <div className="small text-2">打刻修正申請</div>
                <div className="stat-value" style={{ color: pendingCorr ? "#c77a06" : undefined }}>{pendingCorr}<small>件</small></div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-head"><h2>部署別の状況</h2></div>
            <div className="card-body">
              {depts.map((d) => {
                const rows = data.filter((x) => x.emp.departmentId === d.id);
                if (dept !== "all" && d.id !== dept) return null;
                return (
                  <div key={d.id} style={{ marginBottom: 14 }}>
                    <div className="row small" style={{ marginBottom: 4 }}>
                      <b>{d.name}</b>
                      <span className="spacer" />
                      <span className="muted">{rows.length}名</span>
                    </div>
                    <div className="stack">
                      {GROUPS.map((g) => {
                        const n = rows.filter((r) => g.match.includes(r.today.status)).length;
                        return n ? <div key={g.key} title={`${g.label} ${n}名`} style={{ width: `${(n / Math.max(rows.length, 1)) * 100}%`, background: g.color }} /> : null;
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <h2>要確認アラート</h2>
              <span className="right badge b-red">{alerts.length}</span>
            </div>
            <div className="card-body tight" style={{ maxHeight: 280, overflowY: "auto" }}>
              {alerts.length === 0 ? (
                <div className="empty"><IconCheckCircle /> 問題はありません</div>
              ) : (
                alerts.map((a, i) => (
                  <div key={i} className="list-item">
                    <IconAlert style={{ color: a.level === "red" ? "#d6384b" : "#c77a06", flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="bold small">{a.emp.name}</div>
                      <div className="small text-2">{a.text}</div>
                    </div>
                    <Link className="btn btn-sm" href={`/admin/employees/${a.emp.id}`}>確認</Link>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>{formatMonthJa(ym)} 残業時間ランキング</h2>
          <span className="right small muted">赤線は残業アラート基準（{db.settings.overtimeAlertHours}h）</span>
        </div>
        <div className="card-body">
          {ranking.map(({ emp, month }) => {
            const pct = (month.overtimeMin / maxOt) * 100;
            const cls = month.overtimeMin > otLimit ? "danger" : month.overtimeMin > otLimit * 0.8 ? "warn" : "";
            return (
              <div className="bar-row" key={emp.id}>
                <span className="small bold" style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{emp.name}</span>
                <div className="bar-track">
                  <div className={`bar-fill ${cls}`} style={{ width: `${pct}%` }} />
                  <div style={{ position: "absolute", top: -2, bottom: -2, left: `${(otLimit / maxOt) * 100}%`, width: 2, background: "#d6384b", opacity: 0.6 }} />
                </div>
                <span className="small num right-align">{fmtHours(month.overtimeMin)}h</span>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
