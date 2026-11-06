"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { DEMO_ACCOUNTS } from "@/lib/seed";
import {
  IconBuilding,
  IconCalendar,
  IconChart,
  IconCheckCircle,
  IconClock,
  IconDownload,
  IconLogin,
  IconSettings,
  IconUsers,
} from "@/components/Icons";

const FEATURES = [
  { icon: <IconClock size={22} />, title: "ワンタップ打刻", text: "出勤・休憩・退勤をPC/スマホからワンタップ。状態に応じてボタンを制御し、二重打刻を防ぎます。" },
  { icon: <IconChart size={22} />, title: "労働時間の自動集計", text: "実労働・休憩・残業・深夜（22時〜翌5時）・休日労働を自動計算。月次の集計も即座に確認できます。" },
  { icon: <IconCalendar size={22} />, title: "遅刻・早退・欠勤の管理", text: "所定時刻と照合して遅刻・早退・欠勤・打刻漏れを自動判定。アラートで見逃しを防ぎます。" },
  { icon: <IconCheckCircle size={22} />, title: "休暇・修正の申請と承認", text: "有給（全日・半休）や特別休暇、打刻修正をWebで申請。承認すると勤怠へ自動反映されます。" },
  { icon: <IconBuilding size={22} />, title: "部署・従業員単位の把握", text: "誰が勤務中・休憩中・休暇かをリアルタイム表示。部署別の状況や残業ランキングも一目で。" },
  { icon: <IconDownload size={22} />, title: "CSV出力", text: "月次集計・日次明細をExcel対応のCSVで出力。給与計算ソフトへの連携もスムーズです。" },
];

const SCREENS = [
  { img: "/images/screen-admin.jpg", tag: "管理者", title: "全社・部署の勤怠状況をリアルタイムに", text: "在籍・勤務中・休憩中・休暇・未出勤の人数を部署ごとに表示。承認待ちの件数や、打刻漏れ・残業超過のアラートも同じ画面で確認できます。" },
  { img: "/images/screen-attendance.jpg", tag: "集計", title: "月次集計とCSV出力", text: "従業員ごとの出勤日数・総労働・残業・深夜・遅刻・欠勤・有休取得を一覧化。「要確認のみ表示」で締め作業を効率化します。" },
  { img: "/images/screen-timesheet.jpg", tag: "従業員", title: "自分の勤務状況がすぐわかる", text: "日ごとの打刻・労働時間・残業を明細で確認。打刻漏れや誤りがあれば、その行から修正申請ができます。" },
  { img: "/images/screen-approvals.jpg", tag: "承認", title: "申請の承認・却下もかんたん", text: "休暇申請・打刻修正申請を一覧で確認し、コメント付きで承認／却下。一括承認や処理履歴の確認にも対応しています。" },
];

const ROLES = [
  { icon: <IconUsers size={20} />, title: "従業員", items: ["ワンタップ打刻", "勤怠明細・カレンダーの確認", "有給残日数の確認", "休暇・打刻修正の申請"] },
  { icon: <IconBuilding size={20} />, title: "部署マネージャー", items: ["自部署のリアルタイム状況", "部下の勤怠明細の確認", "休暇・修正申請の承認", "部署の月次集計・CSV"] },
  { icon: <IconSettings size={20} />, title: "管理者（人事・総務）", items: ["全社の勤怠・集計・CSV", "勤怠データの直接修正（履歴付き）", "従業員・部署の管理", "就業ルール・休日カレンダー設定"] },
];

const FAQ = [
  { q: "スマートフォンからも打刻できますか？", a: "はい。画面はスマートフォンに最適化されており、ブラウザからそのまま打刻・申請・確認ができます。" },
  { q: "残業や深夜労働はどのように計算されますか？", a: "1日の所定労働時間（初期値8時間）を超えた分を残業、22:00〜翌5:00の勤務を深夜労働、土日・休日カレンダー登録日の勤務を休日労働として自動集計します。" },
  { q: "打刻を忘れた場合はどうなりますか？", a: "退勤打刻のない日は「打刻漏れ」としてアラート表示されます。従業員は勤怠一覧から修正申請を行い、承認されると勤怠データに反映されます。" },
  { q: "給与計算ソフトにデータを渡せますか？", a: "月次集計・日次明細をCSV（Excel対応のBOM付きUTF-8）で出力できます。項目の並びは運用に合わせて調整可能です。" },
];

export default function LandingPage() {
  const store = useStore();
  const loggedIn = !!store?.user;
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="lp">
      <header className="lp-header">
        <div className="lp-container lp-header-inner">
          <Link href="/" className="brand lp-brand">
            <div className="brand-mark">K</div>
            <div>
              <div className="brand-name">KinTrack</div>
              <div className="brand-sub">クラウド勤怠管理</div>
            </div>
          </Link>
          <nav className="lp-nav">
            <a href="#features">機能</a>
            <a href="#screens">画面紹介</a>
            <a href="#roles">権限</a>
            <a href="#faq">よくある質問</a>
          </nav>
          {loggedIn ? (
            <Link href="/dashboard" className="btn btn-primary">マイページへ</Link>
          ) : (
            <Link href="/login" className="btn btn-primary" data-testid="header-login">
              <IconLogin size={16} /> ログイン
            </Link>
          )}
        </div>
      </header>

      <section className="lp-hero">
        <div className="lp-container lp-hero-inner">
          <div className="lp-hero-text">
            <span className="lp-eyebrow">勤怠管理をもっと正確に、もっと効率的に</span>
            <h1>
              毎日の打刻から
              <br />
              月次集計・CSV出力まで、
              <br />
              <span className="lp-grad">ひとつのシステムで。</span>
            </h1>
            <p>
              出退勤・休憩の打刻、労働時間/残業の自動集計、遅刻・早退・欠勤の管理、有給休暇の申請・承認、
              部署・従業員単位の状況把握までを一元化。従業員も管理者も迷わず使える勤怠管理システムです。
            </p>
            <div className="row" style={{ gap: 12 }}>
              <Link href={loggedIn ? "/dashboard" : "/login"} className="btn btn-primary lp-btn-lg">
                <IconLogin size={18} /> {loggedIn ? "マイページを開く" : "ログインしてデモを試す"}
              </Link>
              <a href="#features" className="btn lp-btn-lg lp-btn-ghost">機能を見る</a>
            </div>
            <div className="lp-hero-points">
              <span><IconCheckCircle size={16} /> PC・スマホ対応</span>
              <span><IconCheckCircle size={16} /> 3つの権限ロール</span>
              <span><IconCheckCircle size={16} /> Excel対応CSV</span>
            </div>
          </div>
          <div className="lp-hero-visual">
            <div className="lp-browser">
              <div className="lp-browser-bar"><i /><i /><i /></div>
              <Image src="/images/screen-dashboard.jpg" alt="打刻・マイページ画面" width={1440} height={900} priority sizes="(max-width: 1000px) 100vw, 640px" />
            </div>
            <div className="lp-phone">
              <Image src="/images/screen-mobile.jpg" alt="スマートフォンの打刻画面" width={390} height={844} priority sizes="200px" />
            </div>
          </div>
        </div>
      </section>

      <section className="lp-stats">
        <div className="lp-container lp-stats-inner">
          <div><b>1タップ</b><span>出勤・休憩・退勤の打刻</span></div>
          <div><b>自動</b><span>残業・深夜・休日労働の集計</span></div>
          <div><b>リアルタイム</b><span>部署別の勤務状況</span></div>
          <div><b>CSV</b><span>月次集計・日次明細の出力</span></div>
        </div>
      </section>

      <section id="features" className="lp-section">
        <div className="lp-container">
          <div className="lp-section-head">
            <span className="lp-eyebrow">FEATURES</span>
            <h2>勤怠管理に必要な機能をすべて</h2>
            <p>日々の打刻から締め作業まで、現場と管理部門の手間を減らします。</p>
          </div>
          <div className="lp-features">
            {FEATURES.map((f) => (
              <div key={f.title} className="lp-feature">
                <div className="lp-feature-icon">{f.icon}</div>
                <h3>{f.title}</h3>
                <p>{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="screens" className="lp-section lp-section-alt">
        <div className="lp-container">
          <div className="lp-section-head">
            <span className="lp-eyebrow">SCREENS</span>
            <h2>見やすく、迷わない画面</h2>
            <p>実際のデモ画面です。ログインしてすべての機能をお試しいただけます。</p>
          </div>
          {SCREENS.map((s, i) => (
            <div key={s.img} className={`lp-screen ${i % 2 ? "rev" : ""}`}>
              <div className="lp-screen-img">
                <Image src={s.img} alt={s.title} width={1440} height={900} loading="eager" sizes="(max-width: 1000px) 100vw, 680px" />
              </div>
              <div className="lp-screen-text">
                <span className="badge b-blue">{s.tag}</span>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section id="roles" className="lp-section">
        <div className="lp-container">
          <div className="lp-section-head">
            <span className="lp-eyebrow">ROLES</span>
            <h2>立場に合わせた3つの権限</h2>
            <p>必要な人に、必要な情報だけを。部署単位のアクセス制御に対応しています。</p>
          </div>
          <div className="lp-roles">
            {ROLES.map((r) => (
              <div key={r.title} className="lp-role">
                <div className="row" style={{ gap: 10, marginBottom: 12 }}>
                  <div className="lp-feature-icon">{r.icon}</div>
                  <h3>{r.title}</h3>
                </div>
                <ul>
                  {r.items.map((it) => (
                    <li key={it}><IconCheckCircle size={16} /> {it}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="faq" className="lp-section lp-section-alt">
        <div className="lp-container" style={{ maxWidth: 820 }}>
          <div className="lp-section-head">
            <span className="lp-eyebrow">FAQ</span>
            <h2>よくある質問</h2>
          </div>
          {FAQ.map((f, i) => (
            <div key={f.q} className={`lp-faq ${open === i ? "open" : ""}`}>
              <button onClick={() => setOpen(open === i ? null : i)} aria-expanded={open === i}>
                <span>Q. {f.q}</span>
                <span className="lp-faq-mark">{open === i ? "−" : "+"}</span>
              </button>
              {open === i && <p>{f.a}</p>}
            </div>
          ))}
        </div>
      </section>

      <section className="lp-cta">
        <div className="lp-container lp-cta-inner">
          <div>
            <h2>今すぐデモをお試しください</h2>
            <p>以下のデモアカウントでログインできます。データはお使いのブラウザ内に保存されます。</p>
            <div className="lp-cta-accounts">
              {DEMO_ACCOUNTS.map((a) => (
                <div key={a.email}>
                  <b>{a.label}</b>
                  <span>ID: {a.email} / PW: {a.password}</span>
                </div>
              ))}
            </div>
          </div>
          <Link href={loggedIn ? "/dashboard" : "/login"} className="btn lp-btn-lg lp-btn-white" data-testid="cta-login">
            <IconLogin size={18} /> {loggedIn ? "マイページを開く" : "ログイン画面へ"}
          </Link>
        </div>
      </section>

      <footer className="lp-footer">
        <div className="lp-container row">
          <span>© {new Date().getFullYear()} KinTrack 勤怠管理（デモ）</span>
          <span className="spacer" />
          <Link href="/login">ログイン</Link>
        </div>
      </footer>
    </div>
  );
}
