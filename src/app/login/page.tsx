"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const supabase = createClient();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setStatus("寄送登入連結中...");

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setStatus("發生錯誤：" + error.message);
    } else {
      setStatus("請到信箱點擊登入連結。");
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="border p-8 rounded-lg w-96 space-y-4">
        <h1 className="text-2xl font-bold text-center">
          研經教練 Prototype
        </h1>

        <form onSubmit={handleLogin} className="space-y-3">
          <input
            className="w-full border px-3 py-2 rounded"
            placeholder="your@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <button
            type="submit"
            className="w-full border px-3 py-2 rounded"
          >
            Email 登入
          </button>
        </form>

        {status && <p className="text-sm">{status}</p>}
      </div>
    </main>
  );
}