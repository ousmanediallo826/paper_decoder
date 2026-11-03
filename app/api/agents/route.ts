import { runRoom } from "@/lib/agents";
import type { PaperFile, PaperSummary, RoomEvent } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300; // seven model calls in a row

export async function POST(req: Request) {
  const { file, summary, profile } = (await req.json()) as {
    file?: PaperFile;
    summary?: PaperSummary;
    profile?: string;
  };
  if (!file?.uri || !summary) {
    return Response.json({ error: "Decode a paper first." }, { status: 400 });
  }

  // Stream newline-delimited JSON so each agent's message shows up as soon as it's ready.
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (event: RoomEvent) => controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      try {
        await runRoom(file, summary, (profile ?? "").slice(0, 600), emit);
      } catch (e) {
        console.error(e);
        emit({ type: "error", message: e instanceof Error ? e.message : "The agents hit a problem. Try again." });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-cache" },
  });
}
