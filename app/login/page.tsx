"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { DEMO_ACCOUNTS } from "@/lib/seed";
import { IconChevronLeft, IconLogin } from "@/components/Icons";

function HeroIllustration() {
  return (
    <svg viewBox="0 0 560 300" width="100%" style={{ maxWidth: 560 }} aria-hidden>
      <defs>
        <linearGradient id="lg1" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.98" />
          <stop offset="1" stopColor="#e8f1ff" stopOpacity="0.98" />
        </linearGradient>
      </defs>
      {/* dashboard window */}
      <rect x="10" y="20" width="380" height="250" rx="16" fill="url(#lg1)" />
      <rect x="10" y="20" width="380" height="36" rx="16" fill="#dfeafb" />
      <circle cx="32" cy="38" r="5" fill="#f0574f" />
      <circle cx="48" cy="38" r="5" fill="#f3a21b" />
      <circle cx="64" cy="38" r="5" fill="#18bca9" />
      {/* stat tiles */}
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <rect x={30 + i * 118} y="72" width="104" height="58" rx="10" fill="#fff" stroke="#d6e2f3" />
          <rect x={42 + i * 118} y="84" width="40" height="7" rx="3.5" fill="#c3d3ea" />
          <rect x={42 + i * 118} y="100" width={[56, 44, 64][i]} height="16" rx="5" fill={["#0f6fde", "#10b4a4", "#f3a21b"][i]} />
        </g>
      ))}
      {/* bars */}
      <rect x="30" y="146" width="220" height="108" rx="10" fill="#fff" stroke="#d6e2f3" />
      {[46, 70, 38, 82, 60, 74, 52].map((h, i) => (
        <rect key={i} x={48 + i * 28} y={240 - h} width="16" height={h} rx="4" fill={i === 3 ? "#0f6fde" : "#b9d4f6"} />
      ))}
      {/* list */}
      <rect x="264" y="146" width="106" height="108" rx="10" fill="#fff" stroke="#d6e2f3" />
      {[0, 1, 2, 3].map((i) => (
        <g key={i}>
          <circle cx="282" cy={168 + i * 24} r="7" fill={["#ea580c", "#16a34a", "#9333ea", "#0891b2"][i]} />
          <rect x="295" y={164 + i * 24} width="44" height="7" rx="3.5" fill="#c3d3ea" />
          <rect x="344" y={163 + i * 24} width="16" height="9" rx="4.5" fill={i === 2 ? "#fde3e6" : "#dcf3e8"} />
        </g>
      ))}
      {/* phone with punch button */}
      <rect x="410" y="40" width="130" height="246" rx="22" fill="#0b1a33" />
      <rect x="418" y="50" width="114" height="226" rx="16" fill="#fff" />
      <rect x="456" y="58" width="38" height="5" rx="2.5" fill="#d6e2f3" />
      <text x="475" y="104" textAnchor="middle" fontSize="26" fontWeight="800" fill="#10213d" fontFamily="system-ui">09:00</text>
      <rect x="440" y="114" width="70" height="6" rx="3" fill="#c3d3ea" />
      <rect x="430" y="134" width="90" height="38" rx="10" fill="#0f6fde" />
      <text x="475" y="158" textAnchor="middle" fontSize="13" fontWeight="800" fill="#fff" fontFamily="system-ui">出勤</text>
      <rect x="430" y="180" width="42" height="32" rx="9" fill="#f3a21b" />
      <rect x="478" y="180" width="42" height="32" rx="9" fill="#18bca9" />
      <rect x="430" y="220" width="90" height="38" rx="10" fill="#f0574f" />
      <text x="475" y="244" textAnchor="middle" fontSize="13" fontWeight="800" fill="#fff" fontFamily="system-ui">退勤</text>
    </svg>
  );
}

export default function LoginPage() {
  const store = useStore();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (store?.user) router.replace("/dashboard");
  }, [store?.user, router]);

  const submit = (e?: React.FormEvent, em = email, pw = password) => {
    e?.preventDefault();
    if (!store) return;
    if (!em || !pw) {
      setError("メールアドレスとパスワードを入力してください");
      return;
    }
    if (store.login(em, pw)) {
      setError("");
      router.replace("/dashboard");
    } else {
      setError("メールアドレスまたはパスワードが正しくありません");
    }
  };

  return (
    <div className="login-page">
      <section className="login-hero">
        <Link href="/" className="brand" style={{ padding: 0, color: "#fff", textDecoration: "none" }}>
          <div className="brand-mark">K</div>
          <div>
            <div className="brand-name">KinTrack</div>
            <div className="brand-sub">クラウド勤怠管理</div>
          </div>
        </Link>
        <h1>
          毎日の打刻から月次集計まで。
          <br />
          勤怠管理を、正確に・かんたんに。
        </h1>
        <p className="lead">
          出退勤・休憩の打刻、労働時間/残業/深夜の自動集計、遅刻・早退・欠勤の把握、休暇申請と承認、
          部署単位のリアルタイム状況確認、CSV出力までをひとつに。
        </p>
        <div className="hero-features">
          <div><b>ワンタップ打刻</b>出勤・休憩・退勤をPC/スマホから</div>
          <div><b>自動集計</b>残業・深夜・休日労働を自動計算</div>
          <div><b>申請・承認</b>有休・打刻修正をWebで完結</div>
        </div>
        <div className="hero-illust">
          <HeroIllustration />
        </div>
      </section>

      <section className="login-side">
        <div className="login-box">
          <Link href="/" className="btn btn-sm btn-ghost" style={{ marginLeft: -10, marginBottom: 12 }}>
            <IconChevronLeft size={15} /> トップページへ戻る
          </Link>
          <h2>ログイン</h2>
          <p className="text-2" style={{ marginTop: 0, marginBottom: 20 }}>
            アカウント情報を入力してください
          </p>
          <div className="card card-body" style={{ marginBottom: 18 }}>
            <form onSubmit={submit} noValidate>
              {error && <div className="error-box">{error}</div>}
              <div className="field">
                <label htmlFor="email">メールアドレス</label>
                <input id="email" className="input" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="example@company.jp" />
              </div>
              <div className="field">
                <label htmlFor="password">パスワード</label>
                <input id="password" className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
              </div>
              <button className="btn btn-primary btn-block" style={{ height: 42 }} type="submit" disabled={!store}>
                <IconLogin /> ログイン
              </button>
            </form>
          </div>

          <div className="card">
            <div className="card-head">
              <h2>デモ用ログイン情報</h2>
              <span className="right small muted">クリックでログイン</span>
            </div>
            <div className="card-body">
              <div className="demo-list">
                {DEMO_ACCOUNTS.map((a) => (
                  <button
                    key={a.email}
                    type="button"
                    className="demo-acc"
                    disabled={!store}
                    onClick={() => {
                      setEmail(a.email);
                      setPassword(a.password);
                      submit(undefined, a.email, a.password);
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="bold">{a.label}</div>
                      <div className="small text-2" style={{ margin: "2px 0 4px" }}>{a.note}</div>
                      <div className="small">
                        ID: <code>{a.email}</code>　PW: <code>{a.password}</code>
                      </div>
                    </div>
                    <IconLogin />
                  </button>
                ))}
              </div>
              <p className="small muted" style={{ marginBottom: 0, marginTop: 12 }}>
                ※ その他の従業員アカウント（例: suzuki@demo.jp / ito@demo.jp）のパスワードは <code>demo123</code> です。
                データはブラウザに保存され、設定画面から初期化できます。
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
