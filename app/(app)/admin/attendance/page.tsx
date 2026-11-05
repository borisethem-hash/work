"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useApp, visibleEmployees } from "@/lib/store";
import { buildRecordMap, LEAVE_SHORT, STATUS_LABEL, summarizeMonth } from "@/lib/calc";
import { currentMonth, fmtDuration, fmtHours, formatMonthJa, weekday, WEEK_JA } from "@/lib/date";
import { downloadCSV } from "@/lib/csv";
import { MonthNav, Person, Stat, useToast } from "@/components/ui";
import { IconDownload, IconSearch } from "@/components/Icons";

export default function AttendanceSummaryPage() {
  const { db, user } = useApp();
  const router = useRouter();
  const toast = useToast();
  const [ym, setYm] = useState(currentMonth());
  const [dept, setDept] = useState(user.role === "manager" ? user.departmentId : "all");
  const [q, setQ] = useState("");
  const [onlyIssues, setOnlyIssues] = useState(false);

  const deptName = (id: string) => db.departments.find((d) => d.id === id)?.name ?? "";
  const otLimit = db.settings.overtimeAlertHours * 60;

  const rows = useMemo(() => {
    const map = buildRecordMap(db);
    return visibleEmployees(db, user)
      .filter((e) => e.active && (dept === "all" || e.departmentId === dept))
      .filter((e) => !q || e.name.includes(q) || e.kana.includes(q) || e.code.toLowerCase().includes(q.toLowerCase()))
      .map((e) => ({ emp: e, s: summarizeMonth(db, e, ym, map) }))
      .filter((r) => !onlyIssues || r.s.absentDays + r.s.missingCount + r.s.lateCount + r.s.earlyCount > 0 || r.s.overtimeMin > otLimit);
  }, [db, user, dept, q, ym, onlyIssues, otLimit]);

  const total = rows.reduce(
    (a, r) => ({
      work: a.work + r.s.workMin,
      ot: a.ot + r.s.overtimeMin,
      late: a.late + r.s.lateCount,
      absent: a.absent + r.s.absentDays,
      leave: a.leave + r.s.paidLeaveDays,
      missing: a.missing + r.s.missingCount,
    }),
    { work: 0, ot: 0, late: 0, absent: 0, leave: 0, missing: 0 },
  );

  const exportSummary = () => {
    const out: (string | number)[][] = [
      ["対象月", "社員番号", "氏名", "部署", "役職", "所定日数", "出勤日数", "休日出勤日数", "総労働時間", "残業時間", "深夜時間", "休日労働時間", "遅刻回数", "早退回数", "欠勤日数", "打刻漏れ", "有休取得日数", "その他休暇"],
    ];
    for (const { emp, s } of rows) {
      out.push([ym, emp.code, emp.name, deptName(emp.departmentId), emp.position, s.scheduledDays, s.workDays, s.holidayWorkDays, fmtDuration(s.workMin, false), fmtDuration(s.overtimeMin, false), fmtDuration(s.nightMin, false), fmtDuration(s.holidayWorkMin, false), s.lateCount, s.earlyCount, s.absentDays, s.missingCount, s.paidLeaveDays, s.otherLeaveDays]);
    }
    downloadCSV(`月次勤怠集計_${ym}.csv`, out);
    toast(`${rows.length}名分の月次集計をCSV出力しました`);
  };

  const exportDetail = () => {
    const out: (string | number)[][] = [["社員番号", "氏名", "部署", "日付", "曜日", "区分", "出勤", "退勤", "休憩(分)", "労働時間", "残業時間", "深夜時間", "遅刻(分)", "早退(分)", "備考"]];
    for (const { emp, s } of rows) {
      for (const d of s.days) {
        out.push([emp.code, emp.name, deptName(emp.departmentId), d.date, WEEK_JA[weekday(d.date)], d.leave ? LEAVE_SHORT[d.leave.type] : d.status === "holiday" ? d.holidayName ?? "休日" : STATUS_LABEL[d.status], d.record?.clockIn ?? "", d.record?.clockOut ?? "", d.breakMin, fmtDuration(d.workMin, false), fmtDuration(d.overtimeMin, false), fmtDuration(d.nightMin, false), d.lateMin, d.earlyMin, d.record?.note ?? ""]);
      }
    }
    downloadCSV(`勤怠明細_${ym}.csv`, out);
    toast("日次明細をCSV出力しました");
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>月次集計・CSV出力</h1>
          <p>従業員ごとの月次勤怠を集計し、給与計算用データとして出力できます</p>
        </div>
        <div className="actions">
          <button className="btn" onClick={exportDetail}><IconDownload /> 日次明細CSV</button>
          <button className="btn btn-primary" onClick={exportSummary}><IconDownload /> 月次集計CSV</button>
        </div>
      </div>

      <div className="card card-body mb-16">
        <div className="row">
          <MonthNav value={ym} onChange={setYm} />
          {user.role === "admin" && (
            <select className="select" style={{ width: 200 }} value={dept} onChange={(e) => setDept(e.target.value)}>
              <option value="all">全部署</option>
              {db.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          )}
          <div style={{ position: "relative" }}>
            <IconSearch style={{ position: "absolute", left: 10, top: 10, color: "#8592a6" }} />
            <input className="input" style={{ paddingLeft: 34, width: 220 }} placeholder="氏名・社員番号で検索" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <label className="row small" style={{ gap: 6, cursor: "pointer" }}>
            <input type="checkbox" checked={onlyIssues} onChange={(e) => setOnlyIssues(e.target.checked)} />
            要確認のみ表示
          </label>
        </div>
      </div>

      <div className="grid g-6 mb-16">
        <Stat label="対象人数" value={rows.length} unit="名" />
        <Stat label="総労働時間" value={fmtHours(total.work)} unit="h" />
        <Stat label="総残業時間" value={fmtHours(total.ot)} unit="h" sub={`平均 ${rows.length ? fmtHours(total.ot / rows.length) : "0.0"}h / 人`} />
        <Stat label="遅刻合計" value={total.late} unit="回" />
        <Stat label="欠勤 / 打刻漏れ" value={`${total.absent} / ${total.missing}`} unit="件" color={total.absent + total.missing ? "#d6384b" : undefined} />
        <Stat label="有休取得" value={total.leave} unit="日" />
      </div>

      <div className="card">
        <div className="card-head">
          <h2>{formatMonthJa(ym)} 従業員別集計</h2>
          <span className="right small muted">行をクリックすると日次明細を表示・編集できます</span>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>従業員</th>
                <th>部署</th>
                <th className="r">出勤日数</th>
                <th className="r">総労働</th>
                <th className="r">残業</th>
                <th className="r">深夜</th>
                <th className="r">休日労働</th>
                <th className="r">遅刻</th>
                <th className="r">早退</th>
                <th className="r">欠勤</th>
                <th className="r">打刻漏れ</th>
                <th className="r">有休</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={12} className="empty">該当する従業員がいません</td></tr>
              )}
              {rows.map(({ emp, s }) => (
                <tr key={emp.id} className="clickable" onClick={() => router.push(`/admin/employees/${emp.id}`)}>
                  <td><Person emp={emp} sub={emp.code} /></td>
                  <td>{deptName(emp.departmentId)}</td>
                  <td className="r">{s.workDays}/{s.scheduledDays}</td>
                  <td className="r bold">{fmtDuration(s.workMin, false)}</td>
                  <td className={`r ${s.overtimeMin > otLimit ? "warn-text" : ""}`}>{fmtDuration(s.overtimeMin, false)}</td>
                  <td className="r">{fmtDuration(s.nightMin)}</td>
                  <td className="r">{fmtDuration(s.holidayWorkMin)}</td>
                  <td className="r">{s.lateCount ? <span className="badge b-orange">{s.lateCount}</span> : "-"}</td>
                  <td className="r">{s.earlyCount ? <span className="badge b-orange">{s.earlyCount}</span> : "-"}</td>
                  <td className="r">{s.absentDays ? <span className="badge b-red">{s.absentDays}</span> : "-"}</td>
                  <td className="r">{s.missingCount ? <span className="badge b-red">{s.missingCount}</span> : "-"}</td>
                  <td className="r">{s.paidLeaveDays || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
