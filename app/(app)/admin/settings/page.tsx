"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/lib/store";
import type { Settings } from "@/lib/types";
import { formatDateJa, formatDateTime, hmToMin, isValidHM, todayStr } from "@/lib/date";
import { Empty, useToast } from "@/components/ui";
import { IconEdit, IconPlus, IconRefresh, IconTrash } from "@/components/Icons";

type Tab = "rules" | "departments" | "holidays" | "logs" | "demo";

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>("rules");
  const tabs: [Tab, string][] = [
    ["rules", "就業ルール"],
    ["departments", "部署"],
    ["holidays", "休日カレンダー"],
    ["logs", "操作履歴"],
    ["demo", "デモデータ"],
  ];
  return (
    <>
      <div className="page-head">
        <div>
          <h1>設定</h1>
          <p>就業ルール・部署・休日などの基本設定</p>
        </div>
      </div>
      <div className="card">
        <div className="tabs">
          {tabs.map(([k, label]) => (
            <button key={k} className={`tab ${tab === k ? "active" : ""}`} onClick={() => setTab(k)}>{label}</button>
          ))}
        </div>
        <div className="card-body">
          {tab === "rules" && <Rules />}
          {tab === "departments" && <Departments />}
          {tab === "holidays" && <Holidays />}
          {tab === "logs" && <Logs />}
          {tab === "demo" && <Demo />}
        </div>
      </div>
    </>
  );
}

function Rules() {
  const { db, saveSettings } = useApp();
  const toast = useToast();
  const [s, setS] = useState<Settings>(db.settings);
  const [error, setError] = useState("");
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setS({ ...s, [k]: v });

  const save = () => {
    if (!s.companyName.trim()) return setError("会社名を入力してください");
    if (!isValidHM(s.workStart) || !isValidHM(s.workEnd)) return setError("始業・終業時刻を正しく入力してください");
    if (hmToMin(s.workEnd) <= hmToMin(s.workStart)) return setError("終業時刻は始業時刻より後にしてください");
    if (s.standardMinutes <= 0 || s.breakMinutes < 0) return setError("時間の値が正しくありません");
    setError("");
    saveSettings(s);
    toast("就業ルールを保存しました");
  };

  return (
    <div style={{ maxWidth: 640 }}>
      {error && <div className="error-box">{error}</div>}
      <div className="field"><label>会社名</label><input className="input" value={s.companyName} onChange={(e) => set("companyName", e.target.value)} /></div>
      <div className="form-row">
        <div className="field"><label>始業時刻</label><input className="input" type="time" value={s.workStart} onChange={(e) => set("workStart", e.target.value)} /></div>
        <div className="field"><label>終業時刻</label><input className="input" type="time" value={s.workEnd} onChange={(e) => set("workEnd", e.target.value)} /></div>
      </div>
      <div className="form-row">
        <div className="field"><label>所定休憩時間（分）</label><input className="input" type="number" min={0} value={s.breakMinutes} onChange={(e) => set("breakMinutes", Number(e.target.value))} /></div>
        <div className="field">
          <label>1日の所定労働時間（分）— 超過分を残業として集計</label>
          <input className="input" type="number" min={1} value={s.standardMinutes} onChange={(e) => set("standardMinutes", Number(e.target.value))} />
        </div>
      </div>
      <div className="form-row">
        <div className="field"><label>遅刻の猶予（分）</label><input className="input" type="number" min={0} value={s.lateGraceMinutes} onChange={(e) => set("lateGraceMinutes", Number(e.target.value))} /></div>
        <div className="field"><label>月間残業アラート基準（時間）</label><input className="input" type="number" min={1} value={s.overtimeAlertHours} onChange={(e) => set("overtimeAlertHours", Number(e.target.value))} /></div>
      </div>
      <div className="info-box small mb-16">
        深夜労働は 22:00〜翌5:00、休日（土日・休日カレンダー登録日）の勤務は休日労働として自動集計されます。
      </div>
      <button className="btn btn-primary" onClick={save}>保存</button>
    </div>
  );
}

function Departments() {
  const { db, saveDepartment, deleteDepartment } = useApp();
  const toast = useToast();
  const [name, setName] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  return (
    <div style={{ maxWidth: 640 }}>
      <div className="row mb-16">
        <input className="input" style={{ flex: 1 }} placeholder="新しい部署名" value={name} onChange={(e) => setName(e.target.value)} />
        <button
          className="btn btn-primary"
          onClick={() => {
            if (!name.trim()) return toast("部署名を入力してください", true);
            if (db.departments.some((d) => d.name === name.trim())) return toast("同名の部署があります", true);
            saveDepartment(null, name.trim());
            setName("");
            toast("部署を追加しました");
          }}
        >
          <IconPlus /> 追加
        </button>
      </div>
      <table className="table">
        <thead><tr><th>部署名</th><th className="r">人数</th><th></th></tr></thead>
        <tbody>
          {db.departments.map((d) => (
            <tr key={d.id}>
              <td>
                {editId === d.id ? (
                  <input className="input input-sm" value={editName} onChange={(e) => setEditName(e.target.value)} autoFocus />
                ) : d.name}
              </td>
              <td className="r">{db.employees.filter((e) => e.departmentId === d.id && e.active).length}名</td>
              <td className="r">
                {editId === d.id ? (
                  <>
                    <button className="btn btn-sm btn-primary" onClick={() => { if (editName.trim()) { saveDepartment(d.id, editName.trim()); toast("部署名を変更しました"); } setEditId(null); }}>保存</button>{" "}
                    <button className="btn btn-sm" onClick={() => setEditId(null)}>取消</button>
                  </>
                ) : (
                  <>
                    <button className="btn btn-sm btn-ghost" onClick={() => { setEditId(d.id); setEditName(d.name); }}><IconEdit size={14} /> 名称変更</button>
                    <button
                      className="btn btn-sm btn-ghost"
                      style={{ color: "#d6384b" }}
                      onClick={() => {
                        if (!confirm(`${d.name} を削除しますか？`)) return;
                        const r = deleteDepartment(d.id);
                        toast(r.ok ? "部署を削除しました" : r.message ?? "削除できません", !r.ok);
                      }}
                    >
                      <IconTrash size={14} /> 削除
                    </button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Holidays() {
  const { db, saveSettings } = useApp();
  const toast = useToast();
  const [date, setDate] = useState(todayStr());
  const [name, setName] = useState("");
  const year = todayStr().slice(0, 4);
  const [y, setY] = useState(year);
  const list = db.settings.holidays.filter((h) => h.date.startsWith(y)).sort((a, b) => a.date.localeCompare(b.date));
  const years = Array.from(new Set(db.settings.holidays.map((h) => h.date.slice(0, 4)))).sort();

  return (
    <div style={{ maxWidth: 720 }}>
      <div className="row mb-16">
        <input className="input input-sm" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <input className="input input-sm" style={{ flex: 1, minWidth: 160 }} placeholder="休日名（例：創立記念日）" value={name} onChange={(e) => setName(e.target.value)} />
        <button
          className="btn btn-primary btn-sm"
          onClick={() => {
            if (!date || !name.trim()) return toast("日付と名称を入力してください", true);
            if (db.settings.holidays.some((h) => h.date === date)) return toast("その日はすでに休日に登録されています", true);
            saveSettings({ ...db.settings, holidays: [...db.settings.holidays, { date, name: name.trim() }] });
            setName("");
            setY(date.slice(0, 4));
            toast("休日を追加しました");
          }}
        >
          <IconPlus size={14} /> 会社休日を追加
        </button>
      </div>
      <div className="row mb-16">
        {years.map((yy) => (
          <button key={yy} className={`btn btn-sm ${yy === y ? "btn-primary" : ""}`} onClick={() => setY(yy)}>{yy}年</button>
        ))}
      </div>
      {list.length === 0 ? (
        <Empty>登録された休日はありません</Empty>
      ) : (
        <table className="table">
          <thead><tr><th>日付</th><th>名称</th><th></th></tr></thead>
          <tbody>
            {list.map((h) => (
              <tr key={h.date}>
                <td>{formatDateJa(h.date)}</td>
                <td>{h.name}</td>
                <td className="r">
                  <button
                    className="btn btn-sm btn-ghost"
                    style={{ color: "#d6384b" }}
                    onClick={() => {
                      saveSettings({ ...db.settings, holidays: db.settings.holidays.filter((x) => x.date !== h.date) });
                      toast("休日を削除しました");
                    }}
                  >
                    <IconTrash size={14} /> 削除
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function Logs() {
  const { db } = useApp();
  const nameOf = (id: string) => db.employees.find((e) => e.id === id)?.name ?? "システム";
  if (db.logs.length === 0) return <Empty>操作履歴はありません</Empty>;
  return (
    <div className="table-wrap">
      <table className="table">
        <thead><tr><th>日時</th><th>操作者</th><th>操作</th><th>内容</th></tr></thead>
        <tbody>
          {db.logs.map((l) => (
            <tr key={l.id}>
              <td className="small num">{formatDateTime(l.at)}</td>
              <td>{nameOf(l.actorId)}</td>
              <td><span className="badge b-blue">{l.action}</span></td>
              <td className="text-2">{l.detail}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Demo() {
  const { resetDemo, logout } = useApp();
  const router = useRouter();
  return (
    <div style={{ maxWidth: 640 }}>
      <p className="text-2" style={{ marginTop: 0 }}>
        このデモのデータはお使いのブラウザ（localStorage）に保存されています。打刻・申請・設定変更などをすべて破棄し、
        初期状態（過去3か月分のサンプル勤怠データ）に戻すことができます。なお、日付が変わるとサンプルデータは当日基準で自動的に再生成されます。
      </p>
      <button
        className="btn btn-danger"
        onClick={() => {
          if (!confirm("デモデータを初期化します。よろしいですか？")) return;
          resetDemo();
          logout();
          router.replace("/login");
        }}
      >
        <IconRefresh /> デモデータを初期化してログアウト
      </button>
    </div>
  );
}
