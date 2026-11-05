"use client";

import Timesheet from "@/components/Timesheet";
import { useApp } from "@/lib/store";

export default function TimesheetPage() {
  const { user, db } = useApp();
  const dept = db.departments.find((d) => d.id === user.departmentId);
  return (
    <>
      <div className="page-head">
        <div>
          <h1>勤怠一覧</h1>
          <p>{user.code}　{user.name}（{dept?.name}）— 打刻漏れや誤りは「修正申請」から申請できます</p>
        </div>
      </div>
      <Timesheet employee={user} mode="self" />
    </>
  );
}
