"use client";

import { useMemo, useState } from "react";
import type { BreakPeriod, Employee } from "@/lib/types";
import { useApp } from "@/lib/store";
import { breakMinutes, LEAVE_SHORT, STATUS_LABEL, summarizeMonth, type DayResult } from "@/lib/calc";
import { currentMonth, fmtDuration, fmtHours, formatDateJa, formatDateTime, formatMonthJa, hmToMin, isValidHM, todayStr, weekday, WEEK_JA } from "@/lib/date";
import { downloadCSV } from "@/lib/csv";
import { DayStatusBadge, Modal, MonthNav, Stat, useToast } from "./ui";
import { IconDownload, IconEdit, IconPlus, IconTrash } from "./Icons";

type Mode = "self" | "admin";

export default function Timesheet({ employee, mode }: { employee: Employee; mode: Mode }) {
  const { db } = useApp();
  const [ym, setYm] = useState(currentMonth());
  const [editing, setEditing] = useState<DayResult | null>(null);
  const summary = useMemo(() => summarizeMonth(db, employee, ym), [db, employee, ym]);
  const pendingDates = new Set(
    db.corrections.filter((c) => c.employeeId === employee.id && c.status === "pending").map((c) => c.date),
  );
  const nameOf = (id?: string) => db.employees.find((e) => e.id === id)?.name ?? "";
  const otLimit = db.settings.overtimeAlertHours * 60;

  const exportCSV = () => {
    const rows: (string | number)[][] = [
      ["社員番号", "氏名", "日付", "曜日", "区分", "出勤", "退勤", "休憩(分)", "労働時間", "残業時間", "深夜時間", "休日労働", "遅刻(分)", "早退(分)", "備考"],
    ];
    for (const d of summary.days) {
      rows.push([
        employee.code,
        employee.name,
        d.date,
        WEEK_JA[weekday(d.date)],
        d.leave ? LEAVE_SHORT[d.leave.type] : d.status === "holiday" ? d.holidayName ?? "休日" : STATUS_LABEL[d.status],
        d.record?.clockIn ?? "",
        d.record?.clockOut ?? "",
        d.breakMin,
        fmtDuration(d.workMin, false),
        fmtDuration(d.overtimeMin, false),
        fmtDuration(d.nightMin, false),
        fmtDuration(d.holidayWorkMin, false),
        d.lateMin,
        d.earlyMin,
        d.record?.note ?? "",
      ]);
    }
    rows.push([]);
    rows.push(["合計", "", "", "", `出勤${summary.workDays}日`, "", "", "", fmtDuration(summary.workMin, false), fmtDuration(summary.overtimeMin, false), fmtDuration(summary.nightMin, false), fmtDuration(summary.holidayWorkMin, false), `遅刻${summary.lateCount}回`, `早退${summary.earlyCount}回`, ""]);
    downloadCSV(`勤怠_${employee.code}_${employee.name.replace(/\s/g, "")}_${ym}.csv`, rows);
  };

  return (
    <>
      <div className="row mb-16">
        <MonthNav value={ym} onChange={setYm} />
        <button className="btn btn-sm" onClick={() => setYm(currentMonth())}>今月</button>
        <span className="spacer" />
        <button className="btn" onClick={exportCSV}>
          <IconDownload /> CSV出力
        </button>
      </div>

      <div className="grid g-6 mb-16">
        <Stat label="出勤日数" value={summary.workDays} unit={`/ ${summary.scheduledDays}日`} sub={summary.holidayWorkDays ? `休日出勤 ${summary.holidayWorkDays}日` : undefined} />
        <Stat label="総労働時間" value={fmtHours(summary.workMin)} unit="h" />
        <Stat label="残業時間" value={fmtHours(summary.overtimeMin)} unit="h" color={summary.overtimeMin > otLimit ? "#d6384b" : undefined} sub={`深夜 ${fmtHours(summary.nightMin)}h / 休日 ${fmtHours(summary.holidayWorkMin)}h`} />
        <Stat label="遅刻 / 早退" value={`${summary.lateCount} / ${summary.earlyCount}`} unit="回" />
        <Stat label="欠勤 / 打刻漏れ" value={`${summary.absentDays} / ${summary.missingCount}`} unit="日" color={summary.absentDays + summary.missingCount ? "#d6384b" : undefined} />
        <Stat label="休暇取得" value={summary.paidLeaveDays} unit="日" sub={summary.otherLeaveDays ? `その他休暇 ${summary.otherLeaveDays}日` : "有給休暇"} />
      </div>

      <div className="card">
        <div className="card-head">
          <h2>{formatMonthJa(ym)} 勤怠明細</h2>
          <span className="right small muted">所定 {db.settings.workStart}〜{db.settings.workEnd}（休憩{db.settings.breakMinutes}分）</span>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>日付</th>
                <th>区分</th>
                <th className="c">出勤</th>
                <th className="c">退勤</th>
                <th className="r">休憩</th>
                <th className="r">労働時間</th>
                <th className="r">残業</th>
                <th className="r">深夜</th>
                <th className="c">遅刻/早退</th>
                <th>備考</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {summary.days.map((d) => {
                const w = weekday(d.date);
                const wcls = w === 0 || d.holidayName ? "wd-sun" : w === 6 ? "wd-sat" : "";
                return (
                  <tr key={d.date} className={`${d.offDay ? "off" : ""} ${d.isToday ? "today" : ""}`}>
                    <td className={wcls}>
                      {Number(d.date.slice(5, 7))}/{Number(d.date.slice(8))}（{WEEK_JA[w]}）
                    </td>
                    <td>
                      <div className="row" style={{ gap: 4 }}>
                        <DayStatusBadge day={d} />
                        {d.leave && d.status !== "leave" && <span className="badge b-violet">{LEAVE_SHORT[d.leave.type]}</span>}
                        {pendingDates.has(d.date) && <span className="badge b-orange">修正申請中</span>}
                      </div>
                    </td>
                    <td className="c num">{d.record?.clockIn ?? ""}</td>
                    <td className={`c num ${d.status === "missing_out" ? "warn-text" : ""}`}>
                      {d.record?.clockOut ?? (d.status === "missing_out" ? "未打刻" : "")}
                    </td>
                    <td className="r">{d.record ? fmtDuration(d.breakMin) : ""}</td>
                    <td className="r bold">{d.record ? fmtDuration(d.workMin) : ""}</td>
                    <td className="r">{d.record ? fmtDuration(d.overtimeMin) : ""}</td>
                    <td className="r">{d.record ? fmtDuration(d.nightMin) : ""}</td>
                    <td className="c">
                      {d.lateMin > 0 && <span className="badge b-orange">遅刻{d.lateMin}分</span>}{" "}
                      {d.earlyMin > 0 && <span className="badge b-orange">早退{d.earlyMin}分</span>}
                    </td>
                    <td className="small text-2" style={{ maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis" }} title={d.record?.note}>
                      {d.record?.note}
                      {d.record?.modifiedBy && (
                        <div className="muted" title={d.record.modifiedAt ? formatDateTime(d.record.modifiedAt) : ""}>
                          修正: {nameOf(d.record.modifiedBy)}
                        </div>
                      )}
                    </td>
                    <td className="r">
                      {!d.isFuture &&
                        (mode === "admin" ? (
                          <button className="btn btn-sm btn-ghost" onClick={() => setEditing(d)}>
                            <IconEdit size={15} /> 編集
                          </button>
                        ) : (
                          <button className="btn btn-sm btn-ghost" disabled={pendingDates.has(d.date)} onClick={() => setEditing(d)}>
                            <IconEdit size={15} /> 修正申請
                          </button>
                        ))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td className="bold" colSpan={4} style={{ padding: "12px" }}>月合計</td>
                <td className="r"></td>
                <td className="r bold" style={{ padding: "12px" }}>{fmtDuration(summary.workMin, false)}</td>
                <td className="r bold" style={{ padding: "12px" }}>{fmtDuration(summary.overtimeMin, false)}</td>
                <td className="r bold" style={{ padding: "12px" }}>{fmtDuration(summary.nightMin, false)}</td>
                <td colSpan={3}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {editing && mode === "admin" && <AdminEditModal employee={employee} day={editing} onClose={() => setEditing(null)} />}
      {editing && mode === "self" && <CorrectionModal day={editing} onClose={() => setEditing(null)} />}
    </>
  );
}

function AdminEditModal({ employee, day, onClose }: { employee: Employee; day: DayResult; onClose: () => void }) {
  const { saveRecord, deleteRecord } = useApp();
  const toast = useToast();
  const [clockIn, setClockIn] = useState(day.record?.clockIn ?? "");
  const [clockOut, setClockOut] = useState(day.record?.clockOut ?? "");
  const [breaks, setBreaks] = useState<BreakPeriod[]>(day.record?.breaks.map((b) => ({ ...b })) ?? []);
  const [note, setNote] = useState(day.record?.note ?? "");
  const [error, setError] = useState("");

  const save = () => {
    if (clockIn && !isValidHM(clockIn)) return setError("出勤時刻の形式が正しくありません（HH:mm）");
    if (clockOut && !isValidHM(clockOut)) return setError("退勤時刻の形式が正しくありません（HH:mm）");
    if (clockOut && !clockIn) return setError("退勤時刻のみの登録はできません");
    for (const b of breaks) {
      if (!isValidHM(b.start) || (b.end && !isValidHM(b.end))) return setError("休憩時刻の形式が正しくありません");
      if (b.end && hmToMin(b.end) < hmToMin(b.start)) return setError("休憩終了は休憩開始より後にしてください");
    }
    if (clockIn && clockOut && hmToMin(clockOut) <= hmToMin(clockIn) && hmToMin(clockOut) > 6 * 60)
      return setError("退勤時刻は出勤時刻より後にしてください（翌日早朝までは日跨ぎとして扱います）");
    saveRecord(employee.id, day.date, { clockIn, clockOut, breaks: breaks.filter((b) => b.start), note });
    toast(`${formatDateJa(day.date)} の勤怠を更新しました`);
    onClose();
  };

  const previewBreak = breakMinutes({ id: "", employeeId: "", date: "", clockIn: clockIn || "00:00", breaks: breaks.filter((b) => b.end && isValidHM(b.start) && isValidHM(b.end)) });

  return (
    <Modal
      title={`勤怠の編集：${employee.name}`}
      onClose={onClose}
      footer={
        <>
          {day.record && (
            <button
              className="btn btn-ghost"
              style={{ color: "#d6384b", marginRight: "auto" }}
              onClick={() => {
                if (confirm("この日の打刻データを削除しますか？")) {
                  deleteRecord(employee.id, day.date);
                  toast("打刻データを削除しました");
                  onClose();
                }
              }}
            >
              <IconTrash size={15} /> 削除
            </button>
          )}
          <button className="btn" onClick={onClose}>キャンセル</button>
          <button className="btn btn-primary" onClick={save}>保存</button>
        </>
      }
    >
      <p className="bold" style={{ marginTop: 0 }}>{formatDateJa(day.date)}</p>
      {error && <div className="error-box">{error}</div>}
      <div className="form-row">
        <div className="field">
          <label>出勤時刻</label>
          <input className="input" type="time" value={clockIn} onChange={(e) => setClockIn(e.target.value)} />
        </div>
        <div className="field">
          <label>退勤時刻</label>
          <input className="input" type="time" value={clockOut} onChange={(e) => setClockOut(e.target.value)} />
        </div>
      </div>
      <div className="field">
        <label>休憩（合計 {previewBreak} 分）</label>
        {breaks.map((b, i) => (
          <div className="row" key={i} style={{ marginBottom: 6 }}>
            <input className="input input-sm" type="time" value={b.start} onChange={(e) => setBreaks(breaks.map((x, j) => (j === i ? { ...x, start: e.target.value } : x)))} />
            〜
            <input className="input input-sm" type="time" value={b.end ?? ""} onChange={(e) => setBreaks(breaks.map((x, j) => (j === i ? { ...x, end: e.target.value || undefined } : x)))} />
            <button className="btn btn-ghost btn-sm" onClick={() => setBreaks(breaks.filter((_, j) => j !== i))} aria-label="休憩を削除"><IconTrash size={14} /></button>
          </div>
        ))}
        <div>
          <button className="btn btn-sm" onClick={() => setBreaks([...breaks, { start: "12:00", end: "13:00" }])}>
            <IconPlus size={14} /> 休憩を追加
          </button>
        </div>
      </div>
      <div className="field">
        <label>備考（修正理由）</label>
        <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="例：本人申告により退勤時刻を修正" />
      </div>
      <div className="info-box small">変更内容は修正者・日時とともに記録され、操作履歴に残ります。</div>
    </Modal>
  );
}

function CorrectionModal({ day, onClose }: { day: DayResult; onClose: () => void }) {
  const { submitCorrection, db } = useApp();
  const toast = useToast();
  const [clockIn, setClockIn] = useState(day.record?.clockIn ?? db.settings.workStart);
  const [clockOut, setClockOut] = useState(day.record?.clockOut ?? db.settings.workEnd);
  const [breakMin, setBreakMin] = useState(day.record ? breakMinutes(day.record) || db.settings.breakMinutes : db.settings.breakMinutes);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const isToday = day.date === todayStr();

  const submit = () => {
    if (!isValidHM(clockIn) || !isValidHM(clockOut)) return setError("時刻を正しく入力してください");
    if (hmToMin(clockOut) <= hmToMin(clockIn)) return setError("退勤時刻は出勤時刻より後にしてください");
    if (breakMin < 0 || breakMin > hmToMin(clockOut) - hmToMin(clockIn)) return setError("休憩時間が正しくありません");
    if (!reason.trim()) return setError("申請理由を入力してください");
    submitCorrection({ date: day.date, clockIn, clockOut, breakMinutes: breakMin, reason: reason.trim() });
    toast("打刻修正を申請しました。承認をお待ちください");
    onClose();
  };

  return (
    <Modal
      title="打刻修正申請"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>キャンセル</button>
          <button className="btn btn-primary" onClick={submit}>申請する</button>
        </>
      }
    >
      <p className="bold" style={{ marginTop: 0 }}>{formatDateJa(day.date)}</p>
      <div className="info-box small mb-16">
        現在の記録：出勤 {day.record?.clockIn ?? "なし"} / 退勤 {day.record?.clockOut ?? "なし"}
        {isToday && "（本日分は勤務終了後の申請を推奨します）"}
      </div>
      {error && <div className="error-box">{error}</div>}
      <div className="form-row">
        <div className="field">
          <label>出勤時刻</label>
          <input className="input" type="time" value={clockIn} onChange={(e) => setClockIn(e.target.value)} />
        </div>
        <div className="field">
          <label>退勤時刻</label>
          <input className="input" type="time" value={clockOut} onChange={(e) => setClockOut(e.target.value)} />
        </div>
      </div>
      <div className="field">
        <label>休憩時間（分）</label>
        <input className="input" type="number" min={0} step={5} value={breakMin} onChange={(e) => setBreakMin(Number(e.target.value))} />
      </div>
      <div className="field">
        <label>申請理由</label>
        <textarea className="textarea" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="例：退勤打刻を忘れたため" />
      </div>
    </Modal>
  );
}
