"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useApp, useNow } from "@/lib/store";
import { clockState, evaluateDay, LEAVE_LABEL, paidLeaveBalance, summarizeMonth } from "@/lib/calc";
import { currentMonth, daysInMonth, fmtDuration, fmtHours, formatDateJa, formatMD, formatMonthJa, pad, todayStr, weekday, WEEK_JA } from "@/lib/date";
import { RequestBadge, Stat, useToast } from "@/components/ui";
import { IconAlert, IconCoffee, IconLogin, IconLogout, IconSun } from "@/components/Icons";

export default function Dashboard() {
  const { db, user, punch } = useApp();
  const toast = useToast();
  const now = useNow(1000);
  const today = todayStr();
  const ym = currentMonth();

  const rec = db.records.find((r) => r.employeeId === user.id && r.date === today);
  const state = clockState(rec);
  const todayRes = evaluateDay(db, user, today);
  // useNowで毎秒再描画されるため、勤務中は経過時間がリアルタイムに更新される
  void now;

  const summary = useMemo(() => summarizeMonth(db, user, ym), [db, user, ym]);
  const balance = paidLeaveBalance(db, user);
  const myLeaves = db.leaves.filter((l) => l.employeeId === user.id).slice(0, 4);
  const myCorrections = db.corrections.filter((c) => c.employeeId === user.id && c.status === "pending");
  const missing = summary.days.filter((d) => d.status === "missing_out" || d.status === "absent");

  const doPunch = (k: Parameters<typeof punch>[0]) => {
    const r = punch(k);
    toast(r.message, !r.ok);
  };

  const stateView = {
    off: { label: "未出勤", color: "#8592a6", bg: "#eef1f5" },
    working: { label: "勤務中", color: "#15975f", bg: "#e6f6ee" },
    break: { label: "休憩中", color: "#c77a06", bg: "#fff5e1" },
    done: { label: "退勤済み", color: "#0f6fde", bg: "#eaf3fe" },
  }[state];

  const events: { t: string; label: string; color: string }[] = [];
  if (rec?.clockIn) events.push({ t: rec.clockIn, label: "出勤", color: "#0f6fde" });
  rec?.breaks.forEach((b) => {
    events.push({ t: b.start, label: "休憩開始", color: "#d98a06" });
    if (b.end) events.push({ t: b.end, label: "休憩終了", color: "#0e9a8b" });
  });
  if (rec?.clockOut) events.push({ t: rec.clockOut, label: "退勤", color: "#d6384b" });

  const days = daysInMonth(ym);
  const lead = weekday(days[0]);
  const scheduledSoFar = summary.days.filter((d) => !d.offDay && !d.isFuture).length;
  const attendRate = scheduledSoFar ? Math.round(((summary.workDays + summary.paidLeaveDays) / scheduledSoFar) * 100) : 0;
  const otLimit = db.settings.overtimeAlertHours * 60;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>
            {now.getHours() < 11 ? "おはようございます" : now.getHours() < 18 ? "こんにちは" : "お疲れさまです"}、
            {user.name.split(" ")[1] ?? user.name}さん
          </h1>
          <p>{formatDateJa(today)}　所定 {db.settings.workStart}〜{db.settings.workEnd}</p>
        </div>
      </div>

      {missing.length > 0 && (
        <div className="card card-body mb-16" style={{ borderColor: "#f5c2c9", background: "#fff8f9" }}>
          <div className="row">
            <IconAlert style={{ color: "#d6384b" }} />
            <b>今月、打刻漏れ・欠勤扱いの日が {missing.length} 日あります。</b>
            <span className="text-2 small">{missing.map((d) => formatMD(d.date)).join("、")}</span>
            <span className="spacer" />
            <Link className="btn btn-sm" href="/timesheet">勤怠一覧で確認・修正申請</Link>
          </div>
        </div>
      )}

      <div className="grid g-main mb-16">
        <div className="card clock-card">
          <div className="row" style={{ justifyContent: "center" }}>
            <span className="state-pill" style={{ color: stateView.color, background: stateView.bg }}>
              {(state === "working" || state === "break") && <span className="pulse" />}
              {stateView.label}
            </span>
            {todayRes.leave && <span className="badge b-violet">{LEAVE_LABEL[todayRes.leave.type]}</span>}
            {todayRes.offDay && <span className="badge b-gray">{todayRes.holidayName ?? "休日"}</span>}
          </div>
          <div className="clock-date" style={{ marginTop: 12 }}>{formatDateJa(today)}</div>
          <div className="clock-time">
            {pad(now.getHours())}:{pad(now.getMinutes())}
            <span className="sec">{pad(now.getSeconds())}</span>
          </div>
          <div className="row" style={{ justifyContent: "center", gap: 18 }}>
            <span className="text-2">出勤 <b className="num">{rec?.clockIn ?? "--:--"}</b></span>
            <span className="text-2">退勤 <b className="num">{rec?.clockOut ?? "--:--"}</b></span>
            <span className="text-2">労働 <b className="num">{fmtDuration(todayRes.workMin, false)}</b></span>
            <span className="text-2">休憩 <b className="num">{fmtDuration(todayRes.breakMin, false)}</b></span>
          </div>
          <div className="punch-grid">
            <button className="punch in" disabled={state !== "off"} onClick={() => doPunch("in")}>
              <IconLogin size={22} />出勤<small>Clock in</small>
            </button>
            <button className="punch out" disabled={state !== "working"} onClick={() => doPunch("out")}>
              <IconLogout size={22} />退勤<small>Clock out</small>
            </button>
            <button className="punch bs" disabled={state !== "working"} onClick={() => doPunch("breakStart")}>
              <IconCoffee size={22} />休憩開始<small>Break</small>
            </button>
            <button className="punch be" disabled={state !== "break"} onClick={() => doPunch("breakEnd")}>
              <IconSun size={22} />休憩終了<small>Back to work</small>
            </button>
          </div>
        </div>

        <div className="grid" style={{ alignContent: "start" }}>
          <div className="card">
            <div className="card-head"><h2>本日の打刻履歴</h2></div>
            <div className="card-body">
              {events.length === 0 ? (
                <div className="muted center" style={{ padding: "12px 0" }}>まだ打刻がありません</div>
              ) : (
                <ul className="timeline">
                  {events.map((e, i) => (
                    <li key={i}>
                      <span className="t">{e.t}</span>
                      <span className="badge" style={{ background: e.color + "18", color: e.color }}>{e.label}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          <div className="card">
            <div className="card-head">
              <h2>有給休暇</h2>
              <div className="right"><Link className="btn btn-sm" href="/requests?new=leave">休暇を申請</Link></div>
            </div>
            <div className="card-body row" style={{ gap: 20 }}>
              <div className="ring" style={{ ["--p" as string]: balance.granted ? (balance.remaining / balance.granted) * 100 : 0 }}>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 800 }}>{balance.remaining}</div>
                  <div className="small muted">残日数</div>
                </div>
              </div>
              <div className="text-2" style={{ lineHeight: 2 }}>
                付与日数 <b className="num">{balance.granted}</b> 日<br />
                取得済み <b className="num">{balance.used}</b> 日<br />
                申請中 <b className="num">{balance.pending}</b> 日
              </div>
            </div>
          </div>
        </div>
      </div>

      <h3 style={{ fontSize: 15, margin: "8px 0 12px" }}>{formatMonthJa(ym)}の勤務状況</h3>
      <div className="grid g-6 mb-16">
        <Stat label="出勤日数" value={summary.workDays} unit={`/ ${summary.scheduledDays}日`} />
        <Stat label="総労働時間" value={fmtHours(summary.workMin)} unit="h" />
        <Stat
          label="残業時間"
          value={fmtHours(summary.overtimeMin)}
          unit="h"
          color={summary.overtimeMin > otLimit ? "#d6384b" : undefined}
          sub={`アラート基準 ${db.settings.overtimeAlertHours}h`}
        />
        <Stat label="深夜労働" value={fmtHours(summary.nightMin)} unit="h" />
        <Stat label="遅刻 / 早退" value={`${summary.lateCount} / ${summary.earlyCount}`} unit="回" color={summary.lateCount ? "#c77a06" : undefined} />
        <Stat label="出勤率" value={attendRate} unit="%" sub={`欠勤 ${summary.absentDays}日`} />
      </div>

      <div className="grid g-2">
        <div className="card">
          <div className="card-head">
            <h2>勤務カレンダー</h2>
            <div className="right legend">
              <span><i style={{ background: "#d4e7fd" }} />出勤</span>
              <span><i style={{ background: "#e5defc" }} />休暇</span>
              <span><i style={{ background: "#fbd5da" }} />欠勤/漏れ</span>
            </div>
          </div>
          <div className="card-body">
            <div className="cal">
              {WEEK_JA.map((w, i) => (
                <div key={w} className={`cal-h ${i === 0 ? "wd-sun" : i === 6 ? "wd-sat" : ""}`}>{w}</div>
              ))}
              {Array.from({ length: lead }).map((_, i) => <div key={"b" + i} className="cal-d blank" />)}
              {summary.days.map((d) => {
                let cls = "";
                if (["work", "holiday_work", "working", "break"].includes(d.status)) cls = "work";
                else if (d.status === "leave") cls = "leave";
                else if (d.status === "absent" || d.status === "missing_out") cls = "absent";
                else if (d.offDay) cls = "off";
                return (
                  <div key={d.date} className={`cal-d ${cls} ${d.isToday ? "today" : ""}`} title={d.holidayName}>
                    {Number(d.date.slice(8))}
                    {d.lateMin > 0 && <span className="mk" />}
                  </div>
                );
              })}
            </div>
            <div className="small muted mt-16">● オレンジの点は遅刻のあった日です</div>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <h2>最近の申請</h2>
            <div className="right"><Link className="btn btn-sm" href="/requests">すべて見る</Link></div>
          </div>
          <div className="card-body tight">
            {myLeaves.length === 0 && myCorrections.length === 0 ? (
              <div className="empty">申請はありません</div>
            ) : (
              <>
                {myCorrections.map((c) => (
                  <div key={c.id} className="list-item">
                    <span className="badge b-blue">打刻修正</span>
                    <div style={{ flex: 1 }}>
                      <div className="bold">{formatDateJa(c.date)}</div>
                      <div className="small muted">{c.clockIn}〜{c.clockOut}</div>
                    </div>
                    <RequestBadge status={c.status} />
                  </div>
                ))}
                {myLeaves.map((l) => (
                  <div key={l.id} className="list-item">
                    <span className="badge b-violet">休暇</span>
                    <div style={{ flex: 1 }}>
                      <div className="bold">{LEAVE_LABEL[l.type]}</div>
                      <div className="small muted">
                        {formatDateJa(l.startDate)}{l.endDate !== l.startDate && ` 〜 ${formatDateJa(l.endDate)}`}
                      </div>
                    </div>
                    <RequestBadge status={l.status} />
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
