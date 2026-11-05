"use client";

import { useState } from "react";
import { useApp, visibleEmployees } from "@/lib/store";
import { isPaidLeave, LEAVE_LABEL, leaveDayCount, paidLeaveBalance } from "@/lib/calc";
import { formatDateJa, formatDateTime } from "@/lib/date";
import { Empty, Modal, Person, RequestBadge, useToast } from "@/components/ui";
import type { CorrectionRequest, LeaveRequest } from "@/lib/types";

type Target = { kind: "leave"; item: LeaveRequest } | { kind: "correction"; item: CorrectionRequest };

export default function ApprovalsPage() {
  const { db, user, reviewLeave, reviewCorrection } = useApp();
  const toast = useToast();
  const [tab, setTab] = useState<"pending" | "history">("pending");
  const [target, setTarget] = useState<Target | null>(null);
  const [comment, setComment] = useState("");

  const emps = visibleEmployees(db, user);
  const ids = new Set(emps.map((e) => e.id));
  const empOf = (id: string) => db.employees.find((e) => e.id === id)!;
  const deptName = (id: string) => db.departments.find((d) => d.id === id)?.name ?? "";
  // 自分自身の申請は自分で承認できない（上長/管理者が承認）
  const inScope = (empId: string) => ids.has(empId) && empId !== user.id;

  const leaves = db.leaves.filter((l) => inScope(l.employeeId));
  const corrections = db.corrections.filter((c) => inScope(c.employeeId));
  const pendLeaves = leaves.filter((l) => l.status === "pending");
  const pendCorr = corrections.filter((c) => c.status === "pending");

  type Row = Target & { at: string };
  const history: Row[] = [
    ...leaves.filter((l) => l.status === "approved" || l.status === "rejected").map((l) => ({ kind: "leave" as const, item: l, at: l.reviewedAt ?? l.createdAt })),
    ...corrections.filter((c) => c.status === "approved" || c.status === "rejected").map((c) => ({ kind: "correction" as const, item: c, at: c.reviewedAt ?? c.createdAt })),
  ].sort((a, b) => b.at.localeCompare(a.at));

  const decide = (status: "approved" | "rejected") => {
    if (!target) return;
    if (status === "rejected" && !comment.trim()) {
      toast("却下する場合はコメントを入力してください", true);
      return;
    }
    if (target.kind === "leave") reviewLeave(target.item.id, status, comment.trim() || undefined);
    else reviewCorrection(target.item.id, status, comment.trim() || undefined);
    toast(status === "approved" ? "承認しました" : "却下しました");
    setTarget(null);
    setComment("");
  };

  const bulkApprove = () => {
    if (!confirm(`承認待ち ${pendLeaves.length + pendCorr.length} 件をすべて承認しますか？`)) return;
    pendLeaves.forEach((l) => reviewLeave(l.id, "approved"));
    pendCorr.forEach((c) => reviewCorrection(c.id, "approved"));
    toast("一括承認しました");
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>承認</h1>
          <p>{user.role === "manager" ? `${deptName(user.departmentId)}の` : ""}休暇申請・打刻修正申請を確認して承認／却下します</p>
        </div>
        <div className="actions">
          <button className="btn btn-success" disabled={pendLeaves.length + pendCorr.length === 0} onClick={bulkApprove}>
            すべて承認
          </button>
        </div>
      </div>

      <div className="card">
        <div className="tabs">
          <button className={`tab ${tab === "pending" ? "active" : ""}`} onClick={() => setTab("pending")}>
            承認待ち <span className="badge b-orange">{pendLeaves.length + pendCorr.length}</span>
          </button>
          <button className={`tab ${tab === "history" ? "active" : ""}`} onClick={() => setTab("history")}>
            処理履歴 <span className="badge b-gray">{history.length}</span>
          </button>
        </div>

        {tab === "pending" ? (
          pendLeaves.length + pendCorr.length === 0 ? (
            <Empty>承認待ちの申請はありません</Empty>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>申請者</th>
                    <th>種別</th>
                    <th>内容</th>
                    <th>理由</th>
                    <th>申請日時</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {pendCorr.map((c) => {
                    const e = empOf(c.employeeId);
                    const rec = db.records.find((r) => r.employeeId === c.employeeId && r.date === c.date);
                    return (
                      <tr key={c.id}>
                        <td><Person emp={e} sub={deptName(e.departmentId)} /></td>
                        <td><span className="badge b-blue">打刻修正</span></td>
                        <td>
                          <div className="bold">{formatDateJa(c.date)}</div>
                          <div className="small text-2">
                            {rec?.clockIn ?? "--"}〜{rec?.clockOut ?? "未打刻"} → <b>{c.clockIn}〜{c.clockOut}</b>（休憩{c.breakMinutes}分）
                          </div>
                        </td>
                        <td className="text-2" style={{ whiteSpace: "normal", minWidth: 180 }}>{c.reason}</td>
                        <td className="small">{formatDateTime(c.createdAt)}</td>
                        <td className="r">
                          <button className="btn btn-sm btn-primary" onClick={() => { setTarget({ kind: "correction", item: c }); setComment(""); }}>確認する</button>
                        </td>
                      </tr>
                    );
                  })}
                  {pendLeaves.map((l) => {
                    const e = empOf(l.employeeId);
                    return (
                      <tr key={l.id}>
                        <td><Person emp={e} sub={deptName(e.departmentId)} /></td>
                        <td><span className="badge b-violet">休暇</span></td>
                        <td>
                          <div className="bold">{LEAVE_LABEL[l.type]}（{leaveDayCount(l, db.settings)}日）</div>
                          <div className="small text-2">{formatDateJa(l.startDate)}{l.endDate !== l.startDate && ` 〜 ${formatDateJa(l.endDate)}`}</div>
                        </td>
                        <td className="text-2" style={{ whiteSpace: "normal", minWidth: 180 }}>{l.reason}</td>
                        <td className="small">{formatDateTime(l.createdAt)}</td>
                        <td className="r">
                          <button className="btn btn-sm btn-primary" onClick={() => { setTarget({ kind: "leave", item: l }); setComment(""); }}>確認する</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        ) : history.length === 0 ? (
          <Empty>処理済みの申請はありません</Empty>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>申請者</th>
                  <th>種別</th>
                  <th>内容</th>
                  <th>結果</th>
                  <th>承認者</th>
                  <th>処理日時</th>
                  <th>コメント</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => {
                  const e = empOf(h.item.employeeId);
                  return (
                    <tr key={h.item.id}>
                      <td><Person emp={e} sub={deptName(e.departmentId)} /></td>
                      <td>{h.kind === "leave" ? <span className="badge b-violet">休暇</span> : <span className="badge b-blue">打刻修正</span>}</td>
                      <td className="small">
                        {h.kind === "leave"
                          ? `${LEAVE_LABEL[h.item.type]} ${formatDateJa(h.item.startDate)}${h.item.endDate !== h.item.startDate ? `〜${formatDateJa(h.item.endDate)}` : ""}`
                          : `${formatDateJa(h.item.date)} ${h.item.clockIn}〜${h.item.clockOut}`}
                      </td>
                      <td><RequestBadge status={h.item.status} /></td>
                      <td>{h.item.reviewedBy ? db.employees.find((x) => x.id === h.item.reviewedBy)?.name : ""}</td>
                      <td className="small">{formatDateTime(h.at)}</td>
                      <td className="small text-2">{h.item.comment}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {target && (
        <Modal
          title={target.kind === "leave" ? "休暇申請の確認" : "打刻修正申請の確認"}
          onClose={() => setTarget(null)}
          footer={
            <>
              <button className="btn" onClick={() => setTarget(null)}>閉じる</button>
              <button className="btn btn-danger" onClick={() => decide("rejected")}>却下</button>
              <button className="btn btn-success" onClick={() => decide("approved")}>承認</button>
            </>
          }
        >
          {(() => {
            const e = empOf(target.item.employeeId);
            return (
              <>
                <div className="mb-16"><Person emp={e} sub={`${e.code} / ${deptName(e.departmentId)} / ${e.position}`} /></div>
                {target.kind === "leave" ? (
                  <LeaveDetail item={target.item} />
                ) : (
                  <table className="table mb-16">
                    <tbody>
                      <tr><th>対象日</th><td>{formatDateJa(target.item.date)}</td></tr>
                      <tr><th>現在の記録</th><td>{(() => { const r = db.records.find((x) => x.employeeId === target.item.employeeId && x.date === target.item.date); return `${r?.clockIn ?? "--"} 〜 ${r?.clockOut ?? "未打刻"}`; })()}</td></tr>
                      <tr><th>修正後</th><td className="bold">{target.item.clockIn} 〜 {target.item.clockOut}（休憩 {target.item.breakMinutes}分）</td></tr>
                      <tr><th>理由</th><td style={{ whiteSpace: "normal" }}>{target.item.reason}</td></tr>
                    </tbody>
                  </table>
                )}
                <div className="field">
                  <label>コメント（却下時は必須）</label>
                  <textarea className="textarea" value={comment} onChange={(ev) => setComment(ev.target.value)} placeholder="申請者へのコメント" />
                </div>
                {target.kind === "correction" && <div className="info-box small">承認すると勤怠データが修正内容で更新されます。</div>}
              </>
            );
          })()}
        </Modal>
      )}
    </>
  );
}

function LeaveDetail({ item }: { item: LeaveRequest }) {
  const { db } = useApp();
  const emp = db.employees.find((e) => e.id === item.employeeId)!;
  const bal = paidLeaveBalance(db, emp);
  const n = leaveDayCount(item, db.settings);
  return (
    <table className="table mb-16">
      <tbody>
        <tr><th>種別</th><td>{LEAVE_LABEL[item.type]}</td></tr>
        <tr><th>期間</th><td>{formatDateJa(item.startDate)}{item.endDate !== item.startDate && ` 〜 ${formatDateJa(item.endDate)}`}（{n}日）</td></tr>
        <tr><th>理由</th><td style={{ whiteSpace: "normal" }}>{item.reason}</td></tr>
        {isPaidLeave(item.type) && (
          <tr>
            <th>有給残日数</th>
            <td>
              {bal.remaining}日 → 承認後 <b>{bal.remaining - n}日</b>
              {bal.remaining - n < 0 && <span className="badge b-red" style={{ marginLeft: 6 }}>残日数不足</span>}
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}
