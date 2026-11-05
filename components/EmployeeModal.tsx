"use client";

import { useState } from "react";
import { useApp } from "@/lib/store";
import { todayStr } from "@/lib/date";
import type { Employee, Role } from "@/lib/types";
import { Modal, useToast } from "@/components/ui";

const COLORS = ["#2563eb", "#0d9488", "#ea580c", "#db2777", "#9333ea", "#16a34a", "#0891b2", "#ca8a04", "#e11d48", "#4f46e5", "#475569"];

export default function EmployeeModal({ emp, onClose }: { emp: Employee | null; onClose: () => void }) {
  const { db, user, saveEmployee } = useApp();
  const toast = useToast();
  const [f, setF] = useState<Omit<Employee, "id">>(
    emp ?? {
      code: "",
      name: "",
      kana: "",
      email: "",
      password: "demo123",
      role: "employee",
      departmentId: db.departments[0]?.id ?? "",
      position: "",
      joinDate: todayStr(),
      paidLeaveGranted: 10,
      active: true,
      color: COLORS[db.employees.length % COLORS.length],
    },
  );
  const [error, setError] = useState("");
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF({ ...f, [k]: v });

  const submit = () => {
    if (!f.code.trim() || !f.name.trim() || !f.email.trim()) return setError("社員番号・氏名・メールアドレスは必須です");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email)) return setError("メールアドレスの形式が正しくありません");
    if (f.password.length < 6) return setError("パスワードは6文字以上にしてください");
    if (emp?.id === user.id && (f.role !== "admin" || !f.active)) return setError("ログイン中の管理者自身の権限変更・無効化はできません");
    const r = saveEmployee({ ...f, id: emp?.id, code: f.code.trim(), name: f.name.trim(), email: f.email.trim() });
    if (!r.ok) return setError(r.message ?? "保存に失敗しました");
    toast(emp ? "従業員情報を更新しました" : "従業員を登録しました");
    onClose();
  };

  return (
    <Modal
      title={emp ? "従業員の編集" : "従業員の登録"}
      onClose={onClose}
      wide
      footer={
        <>
          <button className="btn" onClick={onClose}>キャンセル</button>
          <button className="btn btn-primary" onClick={submit}>保存</button>
        </>
      }
    >
      {error && <div className="error-box">{error}</div>}
      <div className="form-row">
        <div className="field"><label>社員番号 *</label><input className="input" value={f.code} onChange={(e) => set("code", e.target.value)} placeholder="S0030" /></div>
        <div className="field"><label>入社日</label><input className="input" type="date" value={f.joinDate} onChange={(e) => set("joinDate", e.target.value)} /></div>
      </div>
      <div className="form-row">
        <div className="field"><label>氏名 *</label><input className="input" value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="山田 太郎" /></div>
        <div className="field"><label>フリガナ</label><input className="input" value={f.kana} onChange={(e) => set("kana", e.target.value)} placeholder="ヤマダ タロウ" /></div>
      </div>
      <div className="form-row">
        <div className="field"><label>メールアドレス（ログインID） *</label><input className="input" value={f.email} onChange={(e) => set("email", e.target.value)} /></div>
        <div className="field"><label>パスワード</label><input className="input" value={f.password} onChange={(e) => set("password", e.target.value)} /></div>
      </div>
      <div className="form-row">
        <div className="field">
          <label>部署</label>
          <select className="select" value={f.departmentId} onChange={(e) => set("departmentId", e.target.value)}>
            {db.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
        <div className="field"><label>役職</label><input className="input" value={f.position} onChange={(e) => set("position", e.target.value)} /></div>
      </div>
      <div className="form-row">
        <div className="field">
          <label>権限</label>
          <select className="select" value={f.role} onChange={(e) => set("role", e.target.value as Role)}>
            <option value="employee">一般（打刻・申請）</option>
            <option value="manager">マネージャー（自部署の確認・承認）</option>
            <option value="admin">管理者（全権限）</option>
          </select>
        </div>
        <div className="field"><label>有給付与日数（当年度）</label><input className="input" type="number" min={0} max={40} step={0.5} value={f.paidLeaveGranted} onChange={(e) => set("paidLeaveGranted", Number(e.target.value))} /></div>
      </div>
      <div className="form-row">
        <div className="field">
          <label>アイコンカラー</label>
          <div className="row">
            {COLORS.map((c) => (
              <button key={c} type="button" onClick={() => set("color", c)} aria-label={c} style={{ width: 24, height: 24, borderRadius: "50%", background: c, border: f.color === c ? "3px solid #10213d" : "2px solid #fff", boxShadow: "0 0 0 1px #cfd7e3", cursor: "pointer" }} />
            ))}
          </div>
        </div>
        <div className="field">
          <label>在籍状況</label>
          <label className="row" style={{ cursor: "pointer" }}>
            <input type="checkbox" checked={f.active} onChange={(e) => set("active", e.target.checked)} /> 在籍中（チェックを外すとログイン不可）
          </label>
        </div>
      </div>
    </Modal>
  );
}
