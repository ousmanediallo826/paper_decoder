import { NextResponse } from "next/server";
import { downloadPdf, isPdf, MAX_PDF_BYTES, summarize, uploadPdf } from "@/lib/gemini";
import type { Audience } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60; // long papers can take a while

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const audience = (form.get("audience") as Audience) || "student";
    const file = form.get("pdf");
    const url = (form.get("url") as string | null)?.trim();

    let bytes: ArrayBuffer;
    if (file instanceof File && file.size > 0) {
      if (file.size > MAX_PDF_BYTES) return error("That PDF is larger than 50 MB.", 400);
      bytes = await file.arrayBuffer();
      if (!isPdf(bytes)) return error("That file isn't a PDF.", 400);
    } else if (url) {
      bytes = await downloadPdf(url);
    } else {
      return error("Upload a PDF or paste a link to one.", 400);
    }

    const paper = await uploadPdf(bytes);
    const summary = await summarize(paper, audience);
    return NextResponse.json({ summary, file: paper });
  } catch (e) {
    console.error(e);
    return error(e instanceof Error ? e.message : "Something went wrong.", 502);
  }
}

function error(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}
