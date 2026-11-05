"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";

export default function Home() {
  const store = useStore();
  const router = useRouter();
  useEffect(() => {
    if (!store) return;
    router.replace(store.user ? "/dashboard" : "/login");
  }, [store, router]);
  return (
    <div className="loading">
      <div>
        <div className="spinner" />
        読み込み中…
      </div>
    </div>
  );
}
