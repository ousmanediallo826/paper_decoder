import { NextResponse } from "next/server";
import { askAboutPaper } from "@/lib/gemini";
import type { ChatTurn, PaperFile } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const { file, question, history } = (await req.json()) as {
      file?: PaperFile;
      question?: string;
      history?: ChatTurn[];
    };
    if (!file?.uri) return NextResponse.json({ error: "Decode a paper first." }, { status: 400 });
    if (!question?.trim()) return NextResponse.json({ error: "Type a question first." }, { status: 400 });

    const answer = await askAboutPaper(file, question.trim(), history ?? []);
    return NextResponse.json({ answer });
  } catch (e) {
    console.error(e);
    const message = e instanceof Error ? e.message : "Something went wrong.";
    // Files API uploads expire after 48 hours
    const hint = /not found|expired|404/i.test(message) ? " The paper may have expired. Decode it again." : "";
    return NextResponse.json({ error: message + hint }, { status: 502 });
  }
}
