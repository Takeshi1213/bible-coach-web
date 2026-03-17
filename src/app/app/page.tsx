"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function AppPage() {
  const supabase = createClient();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [passageText, setPassageText] = useState("");
  const [status, setStatus] = useState("");
  const [sessionId, setSessionId] = useState<string>("");
  const [activePassageText, setActivePassageText] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [messages, setMessages] = useState<Array<{ role: string; content: string }>>([]);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [mode, setMode] = useState<"quick" | "full">("quick");
  const [report, setReport] = useState("");
  const [phaseStep, setPhaseStep] = useState("");
  const [isComplete, setIsComplete] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sessions, setSessions] = useState<any[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        router.push("/login");
      } else {
        setEmail(data.user.email ?? "");
      }
    })();
  }, [router, supabase]);

  useEffect(() => {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, isSending]);
  
  useEffect(() => {
    if (sidebarOpen) {
      loadSessions();
    }
  }, [sidebarOpen]);

  async function logout() {
    await supabase.auth.signOut();
    router.push("/login");
  }
  
  async function generateReport() {
    if (!sessionId || isGeneratingReport) return;

    setIsGeneratingReport(true);

    try {
      const res = await fetch("/api/session/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });

      const data = await res.json();

      if (!res.ok) {
        setReport("目前無法產生研經報告，請稍後再試。");
        return;
      }

      setReport(data.report ?? "");
    } catch {
      setReport("目前無法產生研經報告，請稍後再試。");
    } finally {
      setIsGeneratingReport(false);
    }
  }
  
  async function startSession() {
    setStatus("建立研經流程中...");
    setSessionId("");

    const res = await fetch("/api/session/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({mode}),
    });

    const data = await res.json();
    if (!res.ok) {
      setStatus(`錯誤: ${data.error ?? "unknown"}`);
      return;
    }

    // 成功建立 session 後
    setSessionId(data.sessionId);
    setActivePassageText(passageText);
    setMessages([]);

    // 立刻請教練用經文開始帶
    setIsSending(true);
    try {
      const res2 = await fetch("/api/session/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: data.sessionId,
          passageText: passageText,
          userMessage: "請直接用這段經文開始帶領訓練，先做開始前流程與第一個引導問題。"
        }),
      });
      const d2 = await res2.json();
      if (!res2.ok) throw new Error(d2.error ?? "unknown");

      setMessages([{ role: "assistant", content: d2.reply }]);

      if (d2.memory?.phase_step) {
        setPhaseStep(d2.memory.phase_step);
      }
      if (d2.memory?.is_complete === true) {
        setIsComplete(true);
      }

      setStatus("Session 已建立，教練開始帶領。");
    } catch (e: any) {
      setStatus(`啟動教練失敗：${e?.message ?? "unknown"}`);
    } finally {
      setIsSending(false);
    }
  }

  async function loadSessions() {
  setLoadingSessions(true);
  try {
    const res = await fetch("/api/session/list");
    const data = await res.json();

    if (res.ok) {
      setSessions(data.sessions ?? []);
    } else {
      console.error("loadSessions error:", data.error);
    }
  } catch (e) {
    console.error("loadSessions failed:", e);
  } finally {
    setLoadingSessions(false);
  }
}

function formatDate(dateString: string) {
  const d = new Date(dateString);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}/${m}/${day}`;
}

function getSessionTitle(session: any) {
  const datePart = formatDate(session.created_at);
  const passageRef = session?.summary?.passage_ref?.trim();

  if (passageRef) {
    return `${datePart} ${passageRef}`;
  }

  return `${datePart} 未命名經文`;
}

async function loadSessionDetail(targetSessionId: string) {
  const res = await fetch("/api/session/detail", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId: targetSessionId }),
  });

  const data = await res.json();
  if (!res.ok) return;

  setSessionId(data.session.id);
  setMode(data.session.mode ?? "quick");
  setPhaseStep(data.session.summary?.phase_step ?? "");
  setIsComplete(data.session.summary?.is_complete ?? false);

  setReport(data.session.report ?? "");
  setActivePassageText(data.session.passage_text ?? "");
  setPassageText(data.session.passage_text ?? "");

  const mappedMessages = (data.messages ?? [])
    .filter((m: any) => {
      const text = (m.content ?? "").trim();
      return !(
        m.role === "user" &&
        text.includes("請直接用這段經文開始帶領訓練")
      );
    })
    .map((m: any) => ({
      role: m.role,
      content: m.content,
    }));

  setMessages(mappedMessages);
  setSidebarOpen(false);
}

  async function sendMessage() {
  const text = chatInput.trim();
  if (!text || isSending || !sessionId) return;

  setIsSending(true);

  try {
    setChatInput("");
    setMessages((prev) => [...prev, { role: "user", content: text }]);

    const res = await fetch("/api/session/respond", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId,
        passageText: activePassageText,
        userMessage: text,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      const fallback =
        data.error === "daily_limit_exceeded"
          ? "你今天的使用次數已達上限，明天再回來繼續靈修。"
          : "目前系統有點忙，請稍後再試。";
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `發生錯誤：${data.error ?? "unknown"}` },
      ]);
      return;
    }

    setMessages((prev) => [
      ...prev,
      { role: "assistant", content: data.reply },
    ]);
    if (data.memory?.phase_step) {
      setPhaseStep(data.memory.phase_step);
    }
    if (data.memory?.is_complete === true) {
      setIsComplete(true);
    }

  } catch (e: any) {
    setMessages((prev) => [
      ...prev,
      { role: "assistant", content: "目前系統有點忙，請稍後再試。" },
    ]);
  } finally {
    setIsSending(false);
  }
}

return (
  <main className="min-h-screen flex">
    {sidebarOpen && (
      <aside className="w-72 border-r bg-gray-100 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-black">過去對話</h2>
          <button
            className="text-sm border rounded px-2 py-1 text-black"
            onClick={loadSessions}
          >
            重新整理
          </button>
        </div>
        {loadingSessions && (
          <p className="text-sm text-gray-500">載入中...</p>
        )}

        <div className="space-y-2">
          {sessions.map((s) => (
            <button
              key={s.id}
              onClick={() => loadSessionDetail(s.id)}
              className={`w-full text-left border rounded p-3 hover:bg-gray-200 ${
              sessionId === s.id ? "bg-blue-50 border-blue-300" : ""
              }`}
            >
              <div className="text-sm font-medium text-black">
                {getSessionTitle(s)}
              </div>
              <div className="text-xs text-black">
                {s.mode === "quick" ? "快速訓練" : "完整訓練"}
              </div>
              <div className="text-xs text-gray-400">
                最後更新：{new Date(s.updated_at).toLocaleString("zh-TW")}
              </div>
            </button>
          ))}
        </div>
      </aside>
    )}

    <div className="flex-1 p-8 space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <button
            className="border rounded px-3 py-2"
            onClick={() => setSidebarOpen((v) => !v)}
          >
            ☰
          </button>
          <h1 className="text-xl font-bold">研經教練 Ver.0.0</h1>
        </div>

        <div className="space-x-4">
          <span className="text-sm opacity-80">{email}</span>
          <button onClick={logout} className="border px-3 py-1 rounded">
            登出
          </button>
        </div>
      </div>

      <section className="border rounded p-4 space-y-3">
        <h2 className="font-semibold">貼上經文</h2>
        <textarea
          className="w-full border rounded p-3 min-h-40"
          placeholder="請把今天要研經的經文貼在這裡"
          value={passageText}
          onChange={(e) => setPassageText(e.target.value)}
          disabled={!!sessionId}
        />
        <select
          className="border rounded px-3 py-2"
          value={mode}
          onChange={(e) => setMode(e.target.value as "quick" | "full")}
          disabled={!!sessionId}
        >
          <option value="quick">快速訓練</option>
          <option value="full">完整訓練</option>
        </select>
        <button
          className="border rounded px-3 py-2"
          onClick={startSession}
          disabled={!passageText.trim()}
        >
          開始訓練
        </button>

        {status && <p className="text-sm opacity-80">{status}</p>}
        {sessionId && (
          <>
            <p className="text-sm text-blue-600">
              模式：{mode === "quick" ? "快速訓練" : "完整訓練"}
            </p>
          </>
        )}
      </section>

      {sessionId && (
        <section className="border rounded p-4 space-y-3">
          <h2 className="font-semibold">教練對話</h2>

          <div className="border rounded p-3 space-y-2 h-[420px] overflow-y-auto">
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={`flex ${
                  m.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[75%] rounded-xl px-4 py-2 text-sm ${
                    m.role === "user"
                      ? "bg-blue-500 text-white"
                      : "bg-gray-300 text-gray-900"
                  }`}
                >
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {m.content}
                  </ReactMarkdown>
                </div>
              </div>
            ))}
            {isSending && (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <span>教練思考中</span>
                <div className="flex gap-1">
                  <span className="dot"></span>
                  <span className="dot"></span>
                  <span className="dot"></span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div className="flex gap-2">
            <input
              disabled={isSending}
              className="flex-1 border rounded px-3 py-2"
              placeholder="輸入你的回答..."
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  sendMessage();
                }
              }}
            />
            <button
              className="border rounded px-3 py-2"
              disabled={isSending}
              onClick={sendMessage}
            >
              送出
            </button>
          </div>
        </section>
      )}

      <div className="flex gap-2 flex-wrap">
        <button
          className="border rounded px-3 py-2 text-sm"
          onClick={() => {
            setSessionId("");
            setMessages([]);
            setPassageText("");
            setActivePassageText("");
            setStatus("");
            setChatInput("");
            setPhaseStep("");
            setIsComplete(false);
            setReport("");
            setIsGeneratingReport(false);
          }}
        >
          重新開始
        </button>

        {isComplete && (
          <button
            className="border rounded px-3 py-2"
            onClick={generateReport}
            disabled={isGeneratingReport}
          >
            {isGeneratingReport ? (
            <>
              <span>報告產生中</span>
                <div className="flex gap-1">
                  <span className="dot"></span>
                  <span className="dot"></span>
                  <span className="dot"></span>
                </div>
            </>
            ) : (
              "產生研經報告"
            )}
          </button>
        )}
      </div>

      {report && (
        <section className="border rounded p-4 space-y-3">
          <h2 className="font-semibold">研經報告</h2>

          <textarea
            className="w-full border rounded p-3 min-h-64"
            value={report}
            readOnly
          />

          <button
            className="border px-3 py-1 rounded"
            onClick={() => navigator.clipboard.writeText(report)}
          >
            複製報告
          </button>
        </section>
      )}
    </div>
  </main>
);}