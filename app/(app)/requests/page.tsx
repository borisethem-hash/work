"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/lib/store";
import type { LeaveType } from "@/lib/types";
import { isHalfLeave, isOffDay, isPaidLeave, LEAVE_LABEL, leaveDayCount, paidLeaveBalance } from "@/lib/calc";
import { addDays, formatDateJa, formatDateTime, todayStr } from "@/lib/date";
import { Empty, Modal, RequestBadge, Stat, useToast } from "@/components/ui";
import { IconPlus } from "@/components/Icons";

export default function RequestsPage() {
  const { db, user, cancelLeave, cancelCorrection } = useApp();
  const toast = useToast();
  const [tab, setTab] = useState<"leave" | "correction">("leave");
  const [showNew, setShowNew] = useState(false);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("new") === "leave") setShowNew(true);
  }, []);

  const leaves = db.leaves.filter((l) => l.employeeId === user.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const corrections = db.corrections.filter((c) => c.employeeId === user.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const balance = paidLeaveBalance(db, user);
  const nameOf = (id?: string) => db.employees.find((e) => e.id === id)?.name ?? "";

  return (
    <>
      <div className="page-head">
        <div>
          <h1>休暇・修正申請</h1>
          <p>有給休暇などの休暇申請と、打刻修正申請の状況を確認できます</p>
        </div>
        <div className="actions">
          <button className="btn btn-primary" onClick={() => setShowNew(true)}>
            <IconPlus /> 休暇を申請
          </button>
        </div>
      </div>

      <div className="grid g-4 mb-16">
        <Stat label="有給 残日数" value={balance.remaining} unit="日" color="#10b4a4" />
        <Stat label="付与日数" value={balance.granted} unit="日" />
        <Stat label="取得済み" value={balance.used} unit="日" />
        <Stat label="申請中" value={balance.pending} unit="日" color={balance.pending ? "#c77a06" : undefined} />
      </div>

      <div className="card">
        <div className="tabs">
          <button className={`tab ${tab === "leave" ? "active" : ""}`} onClick={() => setTab("leave")}>
            休暇申請 <span className="badge b-gray">{leaves.length}</span>
          </button>
          <button className={`tab ${tab === "correction" ? "active" : ""}`} onClick={() => setTab("correction")}>
            打刻修正申請 <span className="badge b-gray">{corrections.length}</span>
          </button>
        </div>
        <div className="table-wrap">
          {tab === "leave" ? (
            leaves.length === 0 ? (
              <Empty>休暇申請はありません</Empty>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>申請日</th>
                    <th>種別</th>
                    <th>期間</th>
                    <th className="r">日数</th>
                    <th>理由</th>
                    <th>状態</th>
                    <th>承認者コメント</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {leaves.map((l) => (
                    <tr key={l.id}>
                      <td className="small">{formatDateTime(l.createdAt)}</td>
                      <td>{LEAVE_LABEL[l.type]}</td>
                      <td>
                        {formatDateJa(l.startDate)}
                        {l.endDate !== l.startDate && <> 〜 {formatDateJa(l.endDate)}</>}
                      </td>
                      <td className="r">{leaveDayCount(l, db.settings)}日</td>
                      <td className="text-2">{l.reason}</td>
                      <td><RequestBadge status={l.status} /></td>
                      <td className="small text-2">
                        {l.reviewedBy && <div>{nameOf(l.reviewedBy)}</div>}
                        {l.comment}
                      </td>
                      <td className="r">
                        {l.status === "pending" && (
                          <button className="btn btn-sm" onClick={() => { cancelLeave(l.id); toast("申請を取り消しました"); }}>
                            取消
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          ) : corrections.length === 0 ? (
            <Empty>打刻修正申請はありません。勤怠一覧の各日から申請できます。</Empty>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>申請日</th>
                  <th>対象日</th>
                  <th>修正内容</th>
                  <th>理由</th>
                  <th>状態</th>
                  <th>承認者コメント</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {corrections.map((c) => (
                  <tr key={c.id}>
                    <td className="small">{formatDateTime(c.createdAt)}</td>
                    <td>{formatDateJa(c.date)}</td>
                    <td className="num">{c.clockIn}〜{c.clockOut}（休憩{c.breakMinutes}分）</td>
                    <td className="text-2">{c.reason}</td>
                    <td><RequestBadge status={c.status} /></td>
                    <td className="small text-2">
                      {c.reviewedBy && <div>{nameOf(c.reviewedBy)}</div>}
                      {c.comment}
                    </td>
                    <td className="r">
                      {c.status === "pending" && (
                        <button className="btn btn-sm" onClick={() => { cancelCorrection(c.id); toast("申請を取り消しました"); }}>
                          取消
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showNew && <LeaveModal onClose={() => setShowNew(false)} />}
    </>
  );
}

function LeaveModal({ onClose }: { onClose: () => void }) {
  const { db, user, submitLeave } = useApp();
  const toast = useToast();
  const [type, setType] = useState<LeaveType>("paid_full");
  const nextWorkday = () => {
    let d = addDays(todayStr(), 1);
    for (let i = 0; i < 30 && isOffDay(d, db.settings); i++) d = addDays(d, 1);
    return d;
  };
  const [start, setStart] = useState(nextWorkday);
  const [end, setEnd] = useState(start);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const balance = paidLeaveBalance(db, user);
  const half = isHalfLeave(type);
  const effectiveEnd = half ? start : end;
  const days = leaveDayCount({ type, startDate: start, endDate: effectiveEnd }, db.settings);

  const submit = () => {
    if (!start || !effectiveEnd) return setError("期間を入力してください");
    if (effectiveEnd < start) return setError("終了日は開始日以降を指定してください");
    if (days === 0) return setError("指定期間に勤務日が含まれていません");
    if (isPaidLeave(type) && days > balance.remaining - balance.pending)
      return setError(`有給休暇の残日数が不足しています（申請可能: ${balance.remaining - balance.pending}日）`);
    const overlap = db.leaves.some(
      (l) => l.employeeId === user.id && (l.status === "pending" || l.status === "approved") && l.startDate <= effectiveEnd && l.endDate >= start,
    );
    if (overlap) return setError("指定期間に既存の休暇申請があります");
    if (!reason.trim()) return setError("理由を入力してください");
    submitLeave({ type, startDate: start, endDate: effectiveEnd, reason: reason.trim() });
    toast("休暇を申請しました");
    onClose();
  };

  return (
    <Modal
      title="休暇申請"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>キャンセル</button>
          <button className="btn btn-primary" onClick={submit}>申請する</button>
        </>
      }
    >
      {error && <div className="error-box">{error}</div>}
      <div className="field">
        <label>休暇の種類</label>
        <select className="select" value={type} onChange={(e) => setType(e.target.value as LeaveType)}>
          {(Object.keys(LEAVE_LABEL) as LeaveType[]).map((k) => (
            <option key={k} value={k}>{LEAVE_LABEL[k]}</option>
          ))}
        </select>
      </div>
      <div className="form-row">
        <div className="field">
          <label>{half ? "取得日" : "開始日"}</label>
          <input className="input" type="date" value={start} onChange={(e) => { setStart(e.target.value); if (e.target.value > end) setEnd(e.target.value); }} />
        </div>
        {!half && (
          <div className="field">
            <label>終了日</label>
            <input className="input" type="date" value={end} min={start} onChange={(e) => setEnd(e.target.value)} />
          </div>
        )}
      </div>
      <div className="field">
        <label>理由</label>
        <textarea className="textarea" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="例：私用のため" />
      </div>
      <div className="info-box small">
        取得日数：<b>{days}日</b>（土日・祝日を除く）
        {isPaidLeave(type) && <>　/ 有給残：{balance.remaining}日（申請中 {balance.pending}日）</>}
      </div>
    </Modal>
  );
}
