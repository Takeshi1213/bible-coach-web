import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export async function POST(req: Request) {
  try {
    const { sessionId } = await req.json();

    if (!sessionId) {
      return NextResponse.json({ error: "sessionId required" }, { status: 400 });
    }

    const cookieStore = await cookies();

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set() {},
          remove() {},
        },
      }
    );

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const userId = userData.user.id;

    const { data: session, error: sessionErr } = await supabase
      .from("study_sessions")
      .select("*")
      .eq("id", sessionId)
      .single();

    if (sessionErr || !session || session.user_id !== userId) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const { data: messages, error: msgErr } = await supabase
      .from("messages")
      .select("role, content")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true });

    if (msgErr) {
      return NextResponse.json({ error: msgErr.message }, { status: 500 });
    }

    const historyText = (messages ?? [])
      .map((m) => `${m.role === "user" ? "學員" : "教練"}: ${m.content}`)
      .join("\n\n");

    const system = `
你是一位聖經教師。

請根據學員與教練的完整對話，
整理出一份「研經操練報告」。

要求：
- 使用繁體中文
- 純文字格式
- 清楚分段
- 適合個人靈修紀錄
- 不要提到 AI、系統、模型

請使用以下結構：

一、經文範圍
二、觀察到的重要細節
三、重要問題與討論
四、經文核心信息
五、作者原意
六、屬靈原則
七、個人應用
八、今日金句

只輸出報告內容。
`;

    const resp = await openai.responses.create({
      model: "gpt-4o-mini",
      input: [
        { role: "system", content: system },
        {
          role: "user",
          content: `
經文：
${session.passage_text ?? ""}

對話：
${historyText}
`,
        },
      ],
      temperature: 0.3,
      max_output_tokens: 1400,
    });

    const report = (resp.output_text ?? "").trim();

    const { error: updateErr } = await supabase
      .from("study_sessions")
      .update({
        report,
        report_updated_at: new Date().toISOString(),
      })
      .eq("id", sessionId);

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({ report });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "unknown error" },
      { status: 500 }
    );
  }
}