import type { AttendanceRecord, DB, Employee, LeaveRequest, LeaveType, Settings } from "./types";
import { daysInMonth, eachDate, hmToMin, nowHM, todayStr, weekday } from "./date";

export const LEAVE_LABEL: Record<LeaveType, string> = {
  paid_full: "有給休暇（全日）",
  paid_am: "有給休暇（午前休）",
  paid_pm: "有給休暇（午後休）",
  special: "特別休暇",
  substitute: "振替休日",
  unpaid: "欠勤（届出）",
};

export const LEAVE_SHORT: Record<LeaveType, string> = {
  paid_full: "有休",
  paid_am: "午前休",
  paid_pm: "午後休",
  special: "特休",
  substitute: "振休",
  unpaid: "届出欠勤",
};

export function isHalfLeave(t: LeaveType): boolean {
  return t === "paid_am" || t === "paid_pm";
}

export function isPaidLeave(t: LeaveType): boolean {
  return t === "paid_full" || t === "paid_am" || t === "paid_pm";
}

export function holidayName(date: string, s: Settings): string | undefined {
  return s.holidays.find((h) => h.date === date)?.name;
}

export function isOffDay(date: string, s: Settings): boolean {
  const w = weekday(date);
  return w === 0 || w === 6 || !!holidayName(date, s);
}

export type DayStatus =
  | "work"
  | "working"
  | "break"
  | "leave"
  | "absent"
  | "holiday"
  | "holiday_work"
  | "missing_out"
  | "not_yet"
  | "future";

export const STATUS_LABEL: Record<DayStatus, string> = {
  work: "出勤",
  working: "勤務中",
  break: "休憩中",
  leave: "休暇",
  absent: "欠勤",
  holiday: "休日",
  holiday_work: "休日出勤",
  missing_out: "打刻漏れ",
  not_yet: "未出勤",
  future: "",
};

export interface DayResult {
  date: string;
  offDay: boolean;
  holidayName?: string;
  isToday: boolean;
  isFuture: boolean;
  record?: AttendanceRecord;
  leave?: LeaveRequest;
  pendingLeave?: LeaveRequest;
  status: DayStatus;
  workMin: number;
  breakMin: number;
  overtimeMin: number;
  nightMin: number;
  holidayWorkMin: number;
  lateMin: number;
  earlyMin: number;
}

function overlap(a1: number, a2: number, b1: number, b2: number): number {
  return Math.max(0, Math.min(a2, b2) - Math.max(a1, b1));
}

/** 22:00〜翌5:00 の深夜帯との重なり（分） */
function nightOverlap(s: number, e: number): number {
  let total = 0;
  // 前日22-29 → -120..300, 当日 1320..1740, 翌日 2760..3180
  for (const base of [-1440, 0, 1440]) {
    total += overlap(s, e, base + 1320, base + 1740);
  }
  return total;
}

export function breakMinutes(rec: AttendanceRecord, until?: number): number {
  let total = 0;
  const inMin = rec.clockIn ? hmToMin(rec.clockIn) : 0;
  for (const b of rec.breaks) {
    let s = hmToMin(b.start);
    if (s < inMin) s += 1440;
    let e: number;
    if (b.end) {
      e = hmToMin(b.end);
      if (e < s) e += 1440;
    } else if (until != null) {
      e = until;
    } else continue;
    total += Math.max(0, e - s);
  }
  return total;
}

function breakNight(rec: AttendanceRecord, until?: number): number {
  let total = 0;
  const inMin = rec.clockIn ? hmToMin(rec.clockIn) : 0;
  for (const b of rec.breaks) {
    let s = hmToMin(b.start);
    if (s < inMin) s += 1440;
    let e: number;
    if (b.end) {
      e = hmToMin(b.end);
      if (e < s) e += 1440;
    } else if (until != null) e = until;
    else continue;
    total += nightOverlap(s, e);
  }
  return total;
}

export function evaluateDay(
  db: DB,
  emp: Employee,
  date: string,
  recordMap?: Map<string, AttendanceRecord>,
  today = todayStr(),
): DayResult {
  const s = db.settings;
  const rec = recordMap
    ? recordMap.get(`${emp.id}_${date}`)
    : db.records.find((r) => r.employeeId === emp.id && r.date === date);
  const leaves = db.leaves.filter(
    (l) => l.employeeId === emp.id && l.startDate <= date && l.endDate >= date,
  );
  const leave = leaves.find((l) => l.status === "approved");
  const pendingLeave = leaves.find((l) => l.status === "pending");
  const offDay = isOffDay(date, s);
  const isToday = date === today;
  const isFuture = date > today;

  const res: DayResult = {
    date,
    offDay,
    holidayName: holidayName(date, s),
    isToday,
    isFuture,
    record: rec,
    leave,
    pendingLeave,
    status: "future",
    workMin: 0,
    breakMin: 0,
    overtimeMin: 0,
    nightMin: 0,
    holidayWorkMin: 0,
    lateMin: 0,
    earlyMin: 0,
  };

  const fullLeave = leave && !isHalfLeave(leave.type);

  if (rec?.clockIn) {
    const inMin = hmToMin(rec.clockIn);
    let outMin: number | undefined;
    if (rec.clockOut) {
      outMin = hmToMin(rec.clockOut);
      if (outMin < inMin) outMin += 1440;
    } else if (isToday) {
      outMin = hmToMin(nowHM());
      if (outMin < inMin) outMin += 1440;
    }
    if (outMin != null) {
      const br = breakMinutes(rec, outMin);
      res.breakMin = br;
      res.workMin = Math.max(0, outMin - inMin - br);
      res.nightMin = Math.max(0, nightOverlap(inMin, outMin) - breakNight(rec, outMin));
    }

    let expectedStart = hmToMin(s.workStart);
    let expectedEnd = hmToMin(s.workEnd);
    let standard = s.standardMinutes;
    if (leave?.type === "paid_am") {
      expectedStart = 13 * 60;
      standard = s.standardMinutes / 2;
    }
    if (leave?.type === "paid_pm") {
      expectedEnd = 12 * 60;
      standard = s.standardMinutes / 2;
    }

    if (offDay) {
      res.holidayWorkMin = rec.clockOut ? res.workMin : 0;
    } else {
      if (inMin > expectedStart + s.lateGraceMinutes) res.lateMin = inMin - expectedStart;
      if (rec.clockOut && outMin != null) {
        if (outMin < expectedEnd) res.earlyMin = expectedEnd - outMin;
        res.overtimeMin = Math.max(0, res.workMin - standard);
      }
    }

    if (!rec.clockOut) {
      if (isToday) {
        const onBreak = rec.breaks.some((b) => !b.end);
        res.status = onBreak ? "break" : "working";
      } else {
        res.status = "missing_out";
      }
    } else {
      res.status = offDay ? "holiday_work" : "work";
    }
    if (!rec.clockOut && !isToday) {
      // 打刻漏れ：時間集計は行わない
      res.workMin = 0;
      res.breakMin = 0;
      res.nightMin = 0;
      res.overtimeMin = 0;
    }
    return res;
  }

  if (date < emp.joinDate) {
    res.status = "future";
    return res;
  }
  if (fullLeave) {
    res.status = offDay ? "holiday" : "leave";
    return res;
  }
  if (offDay) {
    res.status = "holiday";
    return res;
  }
  if (isFuture) {
    res.status = leave ? "leave" : "future";
    return res;
  }
  if (isToday) {
    res.status = leave ? "leave" : "not_yet";
    return res;
  }
  res.status = "absent";
  return res;
}

export interface MonthSummary {
  employeeId: string;
  scheduledDays: number;
  workDays: number;
  holidayWorkDays: number;
  workMin: number;
  overtimeMin: number;
  nightMin: number;
  holidayWorkMin: number;
  lateCount: number;
  earlyCount: number;
  absentDays: number;
  paidLeaveDays: number;
  otherLeaveDays: number;
  missingCount: number;
  days: DayResult[];
}

export function buildRecordMap(db: DB): Map<string, AttendanceRecord> {
  const m = new Map<string, AttendanceRecord>();
  for (const r of db.records) m.set(`${r.employeeId}_${r.date}`, r);
  return m;
}

export function summarizeMonth(
  db: DB,
  emp: Employee,
  ym: string,
  recordMap?: Map<string, AttendanceRecord>,
): MonthSummary {
  const map = recordMap ?? buildRecordMap(db);
  const today = todayStr();
  const days = daysInMonth(ym).map((d) => evaluateDay(db, emp, d, map, today));
  const sum: MonthSummary = {
    employeeId: emp.id,
    scheduledDays: 0,
    workDays: 0,
    holidayWorkDays: 0,
    workMin: 0,
    overtimeMin: 0,
    nightMin: 0,
    holidayWorkMin: 0,
    lateCount: 0,
    earlyCount: 0,
    absentDays: 0,
    paidLeaveDays: 0,
    otherLeaveDays: 0,
    missingCount: 0,
    days,
  };
  for (const d of days) {
    if (!d.offDay && d.date >= emp.joinDate) sum.scheduledDays++;
    if (d.status === "work" || d.status === "working" || d.status === "break" || d.status === "missing_out")
      sum.workDays++;
    if (d.status === "holiday_work") sum.holidayWorkDays++;
    sum.workMin += d.workMin;
    sum.overtimeMin += d.overtimeMin;
    sum.nightMin += d.nightMin;
    sum.holidayWorkMin += d.holidayWorkMin;
    if (d.lateMin > 0) sum.lateCount++;
    if (d.earlyMin > 0) sum.earlyCount++;
    if (d.status === "absent") sum.absentDays++;
    if (d.status === "missing_out") sum.missingCount++;
    if (d.leave && !d.offDay && !d.isFuture) {
      if (isPaidLeave(d.leave.type)) sum.paidLeaveDays += isHalfLeave(d.leave.type) ? 0.5 : 1;
      else sum.otherLeaveDays += 1;
    }
  }
  return sum;
}

/** 申請の対象日数（休日を除く） */
export function leaveDayCount(l: Pick<LeaveRequest, "type" | "startDate" | "endDate">, s: Settings): number {
  if (l.endDate < l.startDate) return 0;
  const days = eachDate(l.startDate, l.endDate).filter((d) => !isOffDay(d, s)).length;
  return isHalfLeave(l.type) ? days * 0.5 : days;
}

export interface PaidLeaveBalance {
  granted: number;
  used: number;
  pending: number;
  remaining: number;
}

export function paidLeaveBalance(db: DB, emp: Employee): PaidLeaveBalance {
  let used = 0;
  let pending = 0;
  for (const l of db.leaves) {
    if (l.employeeId !== emp.id || !isPaidLeave(l.type)) continue;
    const n = leaveDayCount(l, db.settings);
    if (l.status === "approved") used += n;
    if (l.status === "pending") pending += n;
  }
  return { granted: emp.paidLeaveGranted, used, pending, remaining: emp.paidLeaveGranted - used };
}

export type ClockState = "off" | "working" | "break" | "done";

export function clockState(rec?: AttendanceRecord): ClockState {
  if (!rec?.clockIn) return "off";
  if (rec.clockOut) return "done";
  if (rec.breaks.some((b) => !b.end)) return "break";
  return "working";
}
