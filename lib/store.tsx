"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type {
  AttendanceRecord,
  BreakPeriod,
  CorrectionRequest,
  DB,
  Employee,
  LeaveRequest,
  RequestStatus,
  Settings,
} from "./types";
import { createSeed, DB_VERSION } from "./seed";
import { nowHM, todayStr } from "./date";

const DB_KEY = "kintai-demo-db";
const SESSION_KEY = "kintai-demo-session";

function uid(prefix: string): string {
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

function loadDB(): DB {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DB;
      // デモ用：日付が変わったらサンプルデータを当日基準で再生成（欠勤だらけになるのを防ぐ）
      if (parsed.version === DB_VERSION && parsed.seededOn === todayStr()) return parsed;
    }
  } catch {
    /* ignore */
  }
  const seed = createSeed();
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(seed));
  } catch {
    /* ignore */
  }
  return seed;
}

type PunchKind = "in" | "out" | "breakStart" | "breakEnd";

export interface Store {
  ready: boolean;
  db: DB;
  user: Employee | null;
  login: (email: string, password: string) => boolean;
  logout: () => void;
  punch: (kind: PunchKind) => { ok: boolean; message: string };
  saveRecord: (employeeId: string, date: string, data: { clockIn?: string; clockOut?: string; breaks: BreakPeriod[]; note?: string }) => void;
  deleteRecord: (employeeId: string, date: string) => void;
  submitLeave: (data: Omit<LeaveRequest, "id" | "status" | "createdAt" | "employeeId">) => void;
  cancelLeave: (id: string) => void;
  reviewLeave: (id: string, status: Extract<RequestStatus, "approved" | "rejected">, comment?: string) => void;
  submitCorrection: (data: Omit<CorrectionRequest, "id" | "status" | "createdAt" | "employeeId">) => void;
  cancelCorrection: (id: string) => void;
  reviewCorrection: (id: string, status: Extract<RequestStatus, "approved" | "rejected">, comment?: string) => void;
  saveEmployee: (emp: Omit<Employee, "id"> & { id?: string }) => { ok: boolean; message?: string };
  saveSettings: (s: Settings) => void;
  saveDepartment: (id: string | null, name: string) => void;
  deleteDepartment: (id: string) => { ok: boolean; message?: string };
  resetDemo: () => void;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [db, setDb] = useState<DB | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const loaded = loadDB();
    setDb(loaded);
    try {
      const sid = localStorage.getItem(SESSION_KEY);
      if (sid && loaded.employees.some((e) => e.id === sid && e.active)) setUserId(sid);
    } catch {
      /* ignore */
    }
  }, []);

  // 別タブでの変更を反映
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === DB_KEY && e.newValue) {
        try {
          setDb(JSON.parse(e.newValue));
        } catch {
          /* ignore */
        }
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const commit = useCallback((fn: (draft: DB) => void) => {
    setDb((prev) => {
      if (!prev) return prev;
      const draft = structuredClone(prev);
      fn(draft);
      try {
        localStorage.setItem(DB_KEY, JSON.stringify(draft));
      } catch {
        /* ignore */
      }
      return draft;
    });
  }, []);

  const user = useMemo(() => db?.employees.find((e) => e.id === userId) ?? null, [db, userId]);

  const store = useMemo<Store | null>(() => {
    if (!db) return null;
    const actor = userId ?? "system";
    const log = (draft: DB, action: string, detail: string) => {
      draft.logs.unshift({ id: uid("g"), at: new Date().toISOString(), actorId: actor, action, detail });
      if (draft.logs.length > 300) draft.logs.length = 300;
    };
    const empName = (draft: DB, id: string) => draft.employees.find((e) => e.id === id)?.name ?? id;

    const upsert = (draft: DB, employeeId: string, date: string, data: Partial<AttendanceRecord>) => {
      const idx = draft.records.findIndex((r) => r.employeeId === employeeId && r.date === date);
      if (idx >= 0) {
        draft.records[idx] = { ...draft.records[idx], ...data };
      } else {
        draft.records.push({ id: uid("r"), employeeId, date, breaks: [], ...data });
      }
    };

    return {
      ready: true,
      db,
      user,
      login: (email, password) => {
        const emp = db.employees.find(
          (e) => e.email.toLowerCase() === email.trim().toLowerCase() && e.password === password,
        );
        if (!emp || !emp.active) return false;
        setUserId(emp.id);
        try {
          localStorage.setItem(SESSION_KEY, emp.id);
        } catch {
          /* ignore */
        }
        return true;
      },
      logout: () => {
        setUserId(null);
        try {
          localStorage.removeItem(SESSION_KEY);
        } catch {
          /* ignore */
        }
      },
      punch: (kind) => {
        if (!user) return { ok: false, message: "ログインしてください" };
        const date = todayStr();
        const t = nowHM();
        const rec = db.records.find((r) => r.employeeId === user.id && r.date === date);
        const onBreak = rec?.breaks.some((b) => !b.end);
        let message = "";
        switch (kind) {
          case "in":
            if (rec?.clockIn) return { ok: false, message: "すでに出勤打刻済みです" };
            commit((d) => upsert(d, user.id, date, { clockIn: t, breaks: [] }));
            message = `${t} に出勤しました`;
            break;
          case "breakStart":
            if (!rec?.clockIn || rec.clockOut) return { ok: false, message: "勤務中ではありません" };
            if (onBreak) return { ok: false, message: "すでに休憩中です" };
            commit((d) => upsert(d, user.id, date, { breaks: [...rec.breaks, { start: t }] }));
            message = `${t} から休憩を開始しました`;
            break;
          case "breakEnd":
            if (!onBreak || !rec) return { ok: false, message: "休憩中ではありません" };
            commit((d) =>
              upsert(d, user.id, date, { breaks: rec.breaks.map((b) => (b.end ? b : { ...b, end: t })) }),
            );
            message = `${t} に休憩を終了しました`;
            break;
          case "out":
            if (!rec?.clockIn) return { ok: false, message: "出勤打刻がありません" };
            if (rec.clockOut) return { ok: false, message: "すでに退勤打刻済みです" };
            commit((d) =>
              upsert(d, user.id, date, {
                clockOut: t,
                breaks: rec.breaks.map((b) => (b.end ? b : { ...b, end: t })),
              }),
            );
            message = `${t} に退勤しました。お疲れさまでした`;
            break;
        }
        return { ok: true, message };
      },
      saveRecord: (employeeId, date, data) =>
        commit((d) => {
          upsert(d, employeeId, date, {
            clockIn: data.clockIn || undefined,
            clockOut: data.clockOut || undefined,
            breaks: data.breaks,
            note: data.note,
            modifiedBy: actor,
            modifiedAt: new Date().toISOString(),
          });
          log(d, "勤怠修正", `${empName(d, employeeId)} ${date} を ${data.clockIn || "--"}〜${data.clockOut || "--"} に修正`);
        }),
      deleteRecord: (employeeId, date) =>
        commit((d) => {
          d.records = d.records.filter((r) => !(r.employeeId === employeeId && r.date === date));
          log(d, "勤怠削除", `${empName(d, employeeId)} ${date} の打刻を削除`);
        }),
      submitLeave: (data) =>
        commit((d) => {
          if (!user) return;
          d.leaves.unshift({ ...data, id: uid("l"), employeeId: user.id, status: "pending", createdAt: new Date().toISOString() });
        }),
      cancelLeave: (id) =>
        commit((d) => {
          const l = d.leaves.find((x) => x.id === id);
          if (l && l.status === "pending") l.status = "canceled";
        }),
      reviewLeave: (id, status, comment) =>
        commit((d) => {
          const l = d.leaves.find((x) => x.id === id);
          if (!l) return;
          l.status = status;
          l.comment = comment;
          l.reviewedBy = actor;
          l.reviewedAt = new Date().toISOString();
          log(d, status === "approved" ? "休暇承認" : "休暇却下", `${empName(d, l.employeeId)} ${l.startDate}〜${l.endDate}`);
        }),
      submitCorrection: (data) =>
        commit((d) => {
          if (!user) return;
          d.corrections.unshift({ ...data, id: uid("c"), employeeId: user.id, status: "pending", createdAt: new Date().toISOString() });
        }),
      cancelCorrection: (id) =>
        commit((d) => {
          const c = d.corrections.find((x) => x.id === id);
          if (c && c.status === "pending") c.status = "canceled";
        }),
      reviewCorrection: (id, status, comment) =>
        commit((d) => {
          const c = d.corrections.find((x) => x.id === id);
          if (!c) return;
          c.status = status;
          c.comment = comment;
          c.reviewedBy = actor;
          c.reviewedAt = new Date().toISOString();
          if (status === "approved") {
            const breaks: BreakPeriod[] = [];
            if (c.breakMinutes > 0) {
              const startMin = 12 * 60;
              const endMin = startMin + c.breakMinutes;
              const hm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
              breaks.push({ start: hm(startMin), end: hm(endMin) });
            }
            upsert(d, c.employeeId, c.date, {
              clockIn: c.clockIn,
              clockOut: c.clockOut,
              breaks,
              note: `修正申請承認: ${c.reason}`,
              modifiedBy: actor,
              modifiedAt: new Date().toISOString(),
            });
          }
          log(d, status === "approved" ? "修正承認" : "修正却下", `${empName(d, c.employeeId)} ${c.date}`);
        }),
      saveEmployee: (emp) => {
        const dup = db.employees.find(
          (e) => e.id !== emp.id && (e.email.toLowerCase() === emp.email.toLowerCase() || e.code === emp.code),
        );
        if (dup) return { ok: false, message: "社員番号またはメールアドレスが重複しています" };
        commit((d) => {
          if (emp.id) {
            const i = d.employees.findIndex((e) => e.id === emp.id);
            if (i >= 0) d.employees[i] = { ...d.employees[i], ...emp, id: emp.id };
            log(d, "従業員更新", emp.name);
          } else {
            d.employees.push({ ...emp, id: uid("e") });
            log(d, "従業員登録", emp.name);
          }
        });
        return { ok: true };
      },
      saveSettings: (s) =>
        commit((d) => {
          d.settings = s;
          log(d, "設定変更", "就業ルール・休日設定を更新");
        }),
      saveDepartment: (id, name) =>
        commit((d) => {
          if (id) {
            const dep = d.departments.find((x) => x.id === id);
            if (dep) dep.name = name;
          } else d.departments.push({ id: uid("d-"), name });
          log(d, "部署設定", name);
        }),
      deleteDepartment: (id) => {
        if (db.employees.some((e) => e.departmentId === id))
          return { ok: false, message: "所属している従業員がいるため削除できません" };
        commit((d) => {
          d.departments = d.departments.filter((x) => x.id !== id);
        });
        return { ok: true };
      },
      resetDemo: () => {
        const seed = createSeed();
        try {
          localStorage.setItem(DB_KEY, JSON.stringify(seed));
        } catch {
          /* ignore */
        }
        setDb(seed);
      },
    };
  }, [db, user, userId, commit]);

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useStore(): Store | null {
  return useContext(Ctx);
}

/** ログイン済み前提で使う（AppShellの内側） */
export function useApp(): Store & { user: Employee } {
  const s = useContext(Ctx);
  if (!s || !s.user) throw new Error("useApp must be used inside authenticated shell");
  return s as Store & { user: Employee };
}

export function useNow(intervalMs = 1000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

/** 閲覧可能な従業員（管理者=全員、マネージャー=自部署） */
export function visibleEmployees(db: DB, user: Employee): Employee[] {
  if (user.role === "admin") return db.employees;
  if (user.role === "manager") return db.employees.filter((e) => e.departmentId === user.departmentId);
  return db.employees.filter((e) => e.id === user.id);
}

export function canManage(user: Employee, target: Employee): boolean {
  if (user.role === "admin") return true;
  if (user.role === "manager") return target.departmentId === user.departmentId;
  return false;
}
