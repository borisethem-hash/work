export type Role = "admin" | "manager" | "employee";

export interface Department {
  id: string;
  name: string;
}

export interface Employee {
  id: string;
  code: string;
  name: string;
  kana: string;
  email: string;
  password: string;
  role: Role;
  departmentId: string;
  position: string;
  joinDate: string; // YYYY-MM-DD
  paidLeaveGranted: number; // 付与日数（当年度）
  active: boolean;
  color: string;
}

export interface BreakPeriod {
  start: string; // HH:mm
  end?: string; // HH:mm
}

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  date: string; // YYYY-MM-DD
  clockIn?: string; // HH:mm
  clockOut?: string; // HH:mm (小さい値は翌日扱い)
  breaks: BreakPeriod[];
  note?: string;
  modifiedBy?: string;
  modifiedAt?: string;
}

export type LeaveType = "paid_full" | "paid_am" | "paid_pm" | "special" | "substitute" | "unpaid";

export type RequestStatus = "pending" | "approved" | "rejected" | "canceled";

export interface LeaveRequest {
  id: string;
  employeeId: string;
  type: LeaveType;
  startDate: string;
  endDate: string;
  reason: string;
  status: RequestStatus;
  createdAt: string;
  reviewedBy?: string;
  reviewedAt?: string;
  comment?: string;
}

export interface CorrectionRequest {
  id: string;
  employeeId: string;
  date: string;
  clockIn: string;
  clockOut: string;
  breakMinutes: number;
  reason: string;
  status: RequestStatus;
  createdAt: string;
  reviewedBy?: string;
  reviewedAt?: string;
  comment?: string;
}

export interface Holiday {
  date: string;
  name: string;
}

export interface Settings {
  companyName: string;
  workStart: string;
  workEnd: string;
  breakMinutes: number;
  standardMinutes: number;
  lateGraceMinutes: number;
  overtimeAlertHours: number; // 月間残業アラート閾値
  holidays: Holiday[];
}

export interface AuditLog {
  id: string;
  at: string;
  actorId: string;
  action: string;
  detail: string;
}

export interface DB {
  version: number;
  seededOn: string;
  departments: Department[];
  employees: Employee[];
  records: AttendanceRecord[];
  leaves: LeaveRequest[];
  corrections: CorrectionRequest[];
  settings: Settings;
  logs: AuditLog[];
}
