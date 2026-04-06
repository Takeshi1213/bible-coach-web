"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const supabase = createClient();
  const router = useRouter();
  
  // 狀態管理：控制目前是輸入 Email 還是輸入驗證碼
  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState("");
  const [token, setToken] = useState(""); // 8位數驗證碼
  const [status, setStatus] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // 第一步：發送 8 位數驗證碼到信箱
  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setStatus("暖身中... 正在發送驗證碼！");

    const { error } = await supabase.auth.signInWithOtp({
      email,
      // 注意：這裡移除了 emailRedirectTo，因為我們不再依賴連結跳轉
    });

    if (error) {
      setStatus("發生錯誤：" + error.message);
    } else {
      setStatus("驗證碼已發送到信箱！請查看並在此輸入。");
      setStep(2); // 切換到輸入驗證碼的畫面
    }
    setIsLoading(false);
  }

  // 第二步：驗證 8 位數密碼
  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setStatus("驗證中，請稍候...");

    const { error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'email', // 指定驗證類型為 email OTP
    });

    if (error) {
      setStatus("驗證失敗：" + error.message);
      setIsLoading(false);
    } else {
      setStatus("登入成功！準備進入訓練！");
      router.push('/app'); // 導向 App 主畫面
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="border p-8 rounded-lg w-full max-w-sm space-y-6 shadow-sm">
        <h1 className="text-2xl font-bold text-center">
          研經教練 Prototype
        </h1>

        {step === 1 ? (
          <form onSubmit={handleSendCode} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">電子信箱</label>
              <input
                className="w-full border px-3 py-2 rounded focus:outline-none focus:border-black"
                placeholder="your@email.com"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full border border-black bg-black text-white px-3 py-2 rounded font-bold hover:bg-gray-800 disabled:opacity-50"
            >
              {isLoading ? "處理中..." : "寄送 8 位數登入碼"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyCode} className="space-y-4">
            <div className="text-center">
              <p className="text-sm font-medium text-gray-600">已將 8 位數密碼寄至：</p>
              <p className="text-sm font-bold mt-1">{email}</p>
            </div>
            
            <div>
              <input
                className="w-full border px-3 py-3 rounded text-center tracking-[0.5em] text-2xl font-bold focus:outline-none focus:border-black"
                placeholder="12345678"
                type="text"
                required
                maxLength={8}
                value={token}
                onChange={(e) => setToken(e.target.value)}
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full border border-black bg-black text-white px-3 py-2 rounded font-bold hover:bg-gray-800 disabled:opacity-50"
            >
              {isLoading ? "驗證中..." : "登入開始訓練！"}
            </button>

            <button
              type="button"
              onClick={() => { setStep(1); setStatus(""); setToken(""); }}
              className="w-full text-sm text-gray-500 underline mt-2"
            >
              修改 Email 或重寄驗證碼
            </button>
          </form>
        )}

        {status && (
          <div className="bg-gray-50 p-3 rounded text-sm text-center font-medium">
            {status}
          </div>
        )}
      </div>
    </main>
  );
}