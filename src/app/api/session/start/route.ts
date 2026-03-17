import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function POST(req: Request) {
  try {
    const { mode, passageText} = await req.json();

    const cookieStore = await cookies();
    const rawMode = (mode ?? "quick").toString().toLowerCase();
    const normalizedMode = rawMode === "full" ? "full" : "quick";
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set(name: string, value: string, options: any) {
            cookieStore.set({ name, value, ...options });
          },
          remove(name: string, options: any) {
            cookieStore.set({ name, value: "", ...options });
          },
        },
      }
    );

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const userId = userData.user.id;

    const { data, error } = await supabase
      .from("study_sessions")
      .insert({
        user_id: userId,
        mode: normalizedMode,
        summary: {},
        passage_sent: false,
        passage_text: passageText.trim(),
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      sessionId: data.id,
      mode: data.mode
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "unknown" },
      { status: 500 }
    );
  }
}