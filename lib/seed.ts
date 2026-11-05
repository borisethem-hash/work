import type { AttendanceRecord, CorrectionRequest, DB, Employee, Holiday, LeaveRequest } from "./types";
import { addDays, addMonths, currentMonth, hmToMin, minToHM, nowHM, todayStr, weekday } from "./date";
import { isOffDay } from "./calc";

export const DB_VERSION = 3;

export const DEMO_ACCOUNTS = [
  { label: "管理者（人事・総務）", email: "admin@demo.jp", password: "admin123", note: "全社の勤怠・承認・設定・従業員管理" },
  { label: "部署マネージャー（営業部長）", email: "manager@demo.jp", password: "manager123", note: "営業部の勤怠確認・申請承認" },
  { label: "一般従業員（営業部）", email: "user@demo.jp", password: "user123", note: "打刻・勤怠確認・休暇/修正申請" },
];

const HOLIDAYS: Holiday[] = [
  ["2025-09-15", "敬老の日"], ["2025-09-23", "秋分の日"], ["2025-10-13", "スポーツの日"],
  ["2025-11-03", "文化の日"], ["2025-11-23", "勤労感謝の日"], ["2025-11-24", "振替休日"],
  ["2025-12-29", "年末休暇"], ["2025-12-30", "年末休暇"], ["2025-12-31", "年末休暇"],
  ["2026-01-01", "元日"], ["2026-01-02", "年始休暇"], ["2026-01-12", "成人の日"], ["2026-02-11", "建国記念の日"],
  ["2026-02-23", "天皇誕生日"], ["2026-03-20", "春分の日"], ["2026-04-29", "昭和の日"],
  ["2026-05-03", "憲法記念日"], ["2026-05-04", "みどりの日"], ["2026-05-05", "こどもの日"],
  ["2026-05-06", "振替休日"], ["2026-07-20", "海の日"], ["2026-08-11", "山の日"],
  ["2026-08-13", "夏季休暇"], ["2026-08-14", "夏季休暇"],
  ["2026-09-21", "敬老の日"], ["2026-09-22", "国民の休日"], ["2026-09-23", "秋分の日"],
  ["2026-10-12", "スポーツの日"], ["2026-11-03", "文化の日"], ["2026-11-23", "勤労感謝の日"],
  ["2026-12-29", "年末休暇"], ["2026-12-30", "年末休暇"], ["2026-12-31", "年末休暇"],
  ["2027-01-01", "元日"], ["2027-01-11", "成人の日"], ["2027-02-11", "建国記念の日"],
  ["2027-02-23", "天皇誕生日"], ["2027-03-21", "春分の日"], ["2027-03-22", "振替休日"],
  ["2027-04-29", "昭和の日"], ["2027-05-03", "憲法記念日"], ["2027-05-04", "みどりの日"],
  ["2027-05-05", "こどもの日"], ["2027-07-19", "海の日"], ["2027-08-11", "山の日"],
  ["2027-09-20", "敬老の日"], ["2027-09-23", "秋分の日"], ["2027-10-11", "スポーツの日"],
  ["2027-11-03", "文化の日"], ["2027-11-23", "勤労感謝の日"],
].map(([date, name]) => ({ date, name }));

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Profile {
  lateP: number;
  earlyP: number;
  absentP: number;
  otMax: number; // 残業最大（分）
  holidayWorkP: number;
}

type EmpSeed = Omit<Employee, "id" | "active"> & { profile: Profile };

const EMPS: EmpSeed[] = [
  { code: "A0001", name: "佐藤 美咲", kana: "サトウ ミサキ", email: "admin@demo.jp", password: "admin123", role: "admin", departmentId: "d-admin", position: "人事総務課長", joinDate: "2015-04-01", paidLeaveGranted: 20, color: "#2563eb", profile: { lateP: 0, earlyP: 0.02, absentP: 0, otMax: 60, holidayWorkP: 0 } },
  { code: "S0001", name: "高橋 健一", kana: "タカハシ ケンイチ", email: "manager@demo.jp", password: "manager123", role: "manager", departmentId: "d-sales", position: "営業部長", joinDate: "2012-04-01", paidLeaveGranted: 20, color: "#0d9488", profile: { lateP: 0.02, earlyP: 0.02, absentP: 0, otMax: 150, holidayWorkP: 0.05 } },
  { code: "S0012", name: "田中 翔太", kana: "タナカ ショウタ", email: "user@demo.jp", password: "user123", role: "employee", departmentId: "d-sales", position: "営業", joinDate: "2021-04-01", paidLeaveGranted: 14, color: "#ea580c", profile: { lateP: 0.08, earlyP: 0.03, absentP: 0.01, otMax: 120, holidayWorkP: 0 } },
  { code: "S0018", name: "鈴木 花子", kana: "スズキ ハナコ", email: "suzuki@demo.jp", password: "demo123", role: "employee", departmentId: "d-sales", position: "営業", joinDate: "2022-04-01", paidLeaveGranted: 12, color: "#db2777", profile: { lateP: 0.03, earlyP: 0.05, absentP: 0, otMax: 60, holidayWorkP: 0 } },
  { code: "S0021", name: "山田 愛", kana: "ヤマダ アイ", email: "yamada@demo.jp", password: "demo123", role: "employee", departmentId: "d-sales", position: "営業アシスタント", joinDate: "2023-10-01", paidLeaveGranted: 10, color: "#9333ea", profile: { lateP: 0.05, earlyP: 0.02, absentP: 0.02, otMax: 45, holidayWorkP: 0 } },
  { code: "D0003", name: "伊藤 大輔", kana: "イトウ ダイスケ", email: "ito@demo.jp", password: "demo123", role: "manager", departmentId: "d-dev", position: "開発部長", joinDate: "2014-04-01", paidLeaveGranted: 20, color: "#16a34a", profile: { lateP: 0.02, earlyP: 0, absentP: 0, otMax: 180, holidayWorkP: 0.1 } },
  { code: "D0015", name: "渡辺 結衣", kana: "ワタナベ ユイ", email: "watanabe@demo.jp", password: "demo123", role: "employee", departmentId: "d-dev", position: "エンジニア", joinDate: "2020-04-01", paidLeaveGranted: 16, color: "#0891b2", profile: { lateP: 0.04, earlyP: 0.02, absentP: 0, otMax: 200, holidayWorkP: 0.08 } },
  { code: "D0022", name: "山本 拓海", kana: "ヤマモト タクミ", email: "yamamoto@demo.jp", password: "demo123", role: "employee", departmentId: "d-dev", position: "エンジニア", joinDate: "2022-10-01", paidLeaveGranted: 11, color: "#ca8a04", profile: { lateP: 0.12, earlyP: 0.02, absentP: 0.02, otMax: 240, holidayWorkP: 0.05 } },
  { code: "D0027", name: "中村 さくら", kana: "ナカムラ サクラ", email: "nakamura@demo.jp", password: "demo123", role: "employee", departmentId: "d-dev", position: "デザイナー", joinDate: "2024-04-01", paidLeaveGranted: 10, color: "#e11d48", profile: { lateP: 0.04, earlyP: 0.04, absentP: 0, otMax: 90, holidayWorkP: 0 } },
  { code: "C0004", name: "小林 直樹", kana: "コバヤシ ナオキ", email: "kobayashi@demo.jp", password: "demo123", role: "employee", departmentId: "d-cs", position: "サポートリーダー", joinDate: "2018-04-01", paidLeaveGranted: 18, color: "#4f46e5", profile: { lateP: 0.02, earlyP: 0.02, absentP: 0, otMax: 90, holidayWorkP: 0.04 } },
  { code: "C0011", name: "加藤 彩", kana: "カトウ アヤ", email: "kato@demo.jp", password: "demo123", role: "employee", departmentId: "d-cs", position: "サポート", joinDate: "2023-04-01", paidLeaveGranted: 11, color: "#c026d3", profile: { lateP: 0.06, earlyP: 0.06, absentP: 0.02, otMax: 30, holidayWorkP: 0 } },
  { code: "A0009", name: "吉田 誠", kana: "ヨシダ マコト", email: "yoshida@demo.jp", password: "demo123", role: "employee", departmentId: "d-admin", position: "経理", joinDate: "2019-04-01", paidLeaveGranted: 17, color: "#475569", profile: { lateP: 0.01, earlyP: 0.01, absentP: 0, otMax: 120, holidayWorkP: 0 } },
];

function nthWeekday(from: string, n: number, s: DB["settings"]): string {
  // n>0: n営業日後, n<0: n営業日前
  let d = from;
  let count = 0;
  const step = n > 0 ? 1 : -1;
  while (count < Math.abs(n)) {
    d = addDays(d, step);
    if (!isOffDay(d, s)) count++;
  }
  return d;
}

export function createSeed(): DB {
  const today = todayStr();
  const now = hmToMin(nowHM());
  const settings: DB["settings"] = {
    companyName: "株式会社サンプル",
    workStart: "09:00",
    workEnd: "18:00",
    breakMinutes: 60,
    standardMinutes: 480,
    lateGraceMinutes: 0,
    overtimeAlertHours: 30,
    holidays: HOLIDAYS,
  };

  const employees: Employee[] = EMPS.map((e, i) => {
    const { profile: _p, ...rest } = e;
    void _p;
    return { ...rest, id: `e${i + 1}`, active: true };
  });
  const idOf = (email: string) => employees.find((e) => e.email === email)!.id;

  const reviewerFor = (email: string) => {
    const dept = employees.find((e) => e.email === email)!.departmentId;
    if (dept === "d-sales" && email !== "manager@demo.jp") return idOf("manager@demo.jp");
    if (dept === "d-dev" && email !== "ito@demo.jp") return idOf("ito@demo.jp");
    return idOf("admin@demo.jp");
  };
  const createdAt = new Date(Date.now() - 86400000 * 3).toISOString();
  const leaves: LeaveRequest[] = [];
  let lid = 1;
  const addLeave = (email: string, type: LeaveRequest["type"], start: string, end: string, status: LeaveRequest["status"], reason: string, comment?: string) => {
    leaves.push({
      id: `l${lid++}`,
      employeeId: idOf(email),
      type,
      startDate: start,
      endDate: end,
      reason,
      status,
      createdAt,
      reviewedBy: status === "approved" || status === "rejected" ? reviewerFor(email) : undefined,
      reviewedAt: status === "approved" || status === "rejected" ? createdAt : undefined,
      comment,
    });
  };

  const past = (n: number) => nthWeekday(today, -n, settings);
  const future = (n: number) => nthWeekday(today, n, settings);

  addLeave("user@demo.jp", "paid_full", past(9), past(9), "approved", "私用のため");
  addLeave("user@demo.jp", "paid_full", future(6), future(6), "pending", "家族の行事のため");
  addLeave("suzuki@demo.jp", "paid_am", past(4), past(4), "approved", "通院のため");
  addLeave("suzuki@demo.jp", "paid_full", future(3), future(4), "pending", "旅行のため");
  addLeave("yamamoto@demo.jp", "paid_full", past(28), past(27), "approved", "帰省のため");
  addLeave("watanabe@demo.jp", "special", future(10), future(12), "pending", "結婚休暇");
  addLeave("kobayashi@demo.jp", "paid_full", past(15), past(15), "rejected", "私用", "繁忙期のため別日で再申請をお願いします");
  addLeave("kobayashi@demo.jp", "paid_full", past(12), past(12), "approved", "私用（再申請）");
  addLeave("kato@demo.jp", "paid_pm", future(2), future(2), "pending", "役所手続きのため");
  addLeave("nakamura@demo.jp", "paid_full", today, today, "approved", "体調不良のため");
  addLeave("yoshida@demo.jp", "paid_full", past(20), past(18), "approved", "夏季休暇の振替");
  addLeave("ito@demo.jp", "paid_pm", past(6), past(6), "approved", "子どもの学校行事");

  const leaveOn = (empId: string, date: string) =>
    leaves.find((l) => l.employeeId === empId && l.status === "approved" && l.startDate <= date && l.endDate >= date);

  const records: AttendanceRecord[] = [];
  const start = `${addMonths(currentMonth(), -3)}-01`;
  let rid = 1;

  EMPS.forEach((seed, idx) => {
    const emp = employees[idx];
    const rnd = mulberry32(1000 + idx * 7919);
    const p = seed.profile;
    let d = start;
    while (d <= today) {
      const r = rnd();
      const r2 = rnd();
      const r3 = rnd();
      const r4 = rnd();
      const off = isOffDay(d, settings);
      const leave = leaveOn(emp.id, d);
      const isToday = d === today;
      const cur = d;
      d = addDays(d, 1);

      if (leave && leave.type !== "paid_am" && leave.type !== "paid_pm") continue;
      if (off) {
        if (weekday(cur) !== 6 || r >= p.holidayWorkP || isToday) continue;
        // 休日出勤
        const inM = 600 + Math.floor(r2 * 30);
        const outM = inM + 240 + Math.floor(r3 * 120);
        records.push({ id: `r${rid++}`, employeeId: emp.id, date: cur, clockIn: minToHM(inM), clockOut: minToHM(outM), breaks: [], note: "リリース対応" });
        continue;
      }
      if (!isToday && r < p.absentP) continue; // 欠勤

      // 出勤
      let inM: number;
      if (leave?.type === "paid_am") inM = 12 * 60 + 45 + Math.floor(r2 * 12);
      else if (r2 < p.lateP) inM = 9 * 60 + 3 + Math.floor(r3 * 45);
      else inM = 8 * 60 + 35 + Math.floor(r3 * 24);

      let outM: number;
      if (leave?.type === "paid_pm") outM = 12 * 60 + Math.floor(r4 * 8);
      else if (r4 < p.earlyP) outM = 16 * 60 + 20 + Math.floor(r3 * 80);
      else {
        const ot = r4 < 0.35 ? 0 : Math.floor(Math.pow(rnd(), 1.4) * p.otMax);
        outM = 18 * 60 + Math.floor(rnd() * 10) + ot;
      }

      const hasLunch = !leave;
      const bs = 12 * 60 + Math.floor(rnd() * 10);
      const breaks = hasLunch ? [{ start: minToHM(bs), end: minToHM(bs + 60) }] : [];
      if (outM > 20 * 60 + 30 && hasLunch) breaks.push({ start: "19:00", end: "19:15" });

      if (isToday) {
        // 今日：現在時刻までの状態を再現（デモ用アカウントは未打刻）
        if (emp.email === "user@demo.jp" || emp.email === "admin@demo.jp") continue;
        if (now < inM) continue;
        const todayBreaks = [] as AttendanceRecord["breaks"];
        if (hasLunch && now >= bs) todayBreaks.push(now >= bs + 60 ? { start: minToHM(bs), end: minToHM(bs + 60) } : { start: minToHM(bs) });
        const rec: AttendanceRecord = { id: `r${rid++}`, employeeId: emp.id, date: cur, clockIn: minToHM(inM), breaks: todayBreaks };
        if (now >= outM && now >= 18 * 60) rec.clockOut = minToHM(outM);
        records.push(rec);
        continue;
      }

      records.push({
        id: `r${rid++}`,
        employeeId: emp.id,
        date: cur,
        clockIn: minToHM(inM),
        clockOut: minToHM(outM % 1440),
        breaks,
      });
    }
  });

  // 打刻漏れを意図的に作成（修正申請デモ用）
  const missingDate = past(2);
  const userRec = records.find((r) => r.employeeId === idOf("user@demo.jp") && r.date === missingDate);
  if (userRec) delete userRec.clockOut;
  const yamadaMissing = past(3);
  const yRec = records.find((r) => r.employeeId === idOf("yamada@demo.jp") && r.date === yamadaMissing);
  if (yRec) delete yRec.clockOut;

  const corrections: CorrectionRequest[] = [];
  if (yRec) {
    corrections.push({ id: "c1", employeeId: idOf("yamada@demo.jp"), date: yamadaMissing, clockIn: yRec.clockIn!, clockOut: "18:05", breakMinutes: 60, reason: "退勤打刻を忘れました", status: "pending", createdAt });
  }
  const nkDate = past(5);
  const nkRec = records.find((r) => r.employeeId === idOf("nakamura@demo.jp") && r.date === nkDate);
  if (nkRec) {
    corrections.push({ id: "c2", employeeId: idOf("nakamura@demo.jp"), date: nkDate, clockIn: "08:55", clockOut: nkRec.clockOut ?? "18:00", breakMinutes: 60, reason: "打刻端末の不具合で出勤打刻が遅れて記録されました", status: "pending", createdAt });
  }

  return {
    version: DB_VERSION,
    seededOn: today,
    departments: [
      { id: "d-sales", name: "営業部" },
      { id: "d-dev", name: "開発部" },
      { id: "d-cs", name: "カスタマーサポート部" },
      { id: "d-admin", name: "管理部" },
    ],
    employees,
    records,
    leaves,
    corrections,
    settings,
    logs: [
      { id: "g1", at: createdAt, actorId: idOf("admin@demo.jp"), action: "システム", detail: "デモデータを初期化しました" },
    ],
  };
}
