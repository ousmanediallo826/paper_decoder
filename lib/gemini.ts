// Server-side only: imported by the API routes, never by the page.
import { FileState, GoogleGenAI, Type, createPartFromUri } from "@google/genai";
import type { GenerateContentParameters, GenerateContentResponse } from "@google/genai";
import type { Audience, ChatTurn, PaperFile, PaperSummary } from "./types";

// Models to try, in order. If one is overloaded or unavailable, the next one is used.
// Override with GEMINI_MODELS=model-a,model-b in .env.local.
const DEFAULT_MODELS = [
  "gemini-3.8-flash",
  "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
];
export const MODELS = [
  ...new Set(
    [
      ...(process.env.GEMINI_MODELS?.split(",") ?? []),
      process.env.GEMINI_MODEL ?? "",
      ...DEFAULT_MODELS,
    ].map((m) => m.trim()).filter(Boolean),
  ),
];
export const MAX_PDF_BYTES = 50 * 1024 * 1024;

let client: GoogleGenAI | null = null;
export function ai() {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is missing. Add it to .env.local and restart the dev server.");
  }
  client ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return client;
}

// The last model that worked is tried first next time, so we don't keep hitting a busy one.
// Fast calls (agent chat turns) keep their own memory, since they start with the lite models.
let preferred = MODELS[0];
let preferredFast = MODELS.find((m) => /lite/.test(m)) ?? MODELS[0];
let thinkingUnsupported = false;

function errorInfo(e: unknown) {
  const status = Number((e as { status?: number })?.status ?? 0);
  const message = e instanceof Error ? e.message : String(e);
  return { status, message };
}

/** Busy or temporarily broken: worth a quick retry, then another model. */
function isTemporary(status: number, message: string) {
  return [429, 500, 502, 503, 504].includes(status) ||
    /UNAVAILABLE|RESOURCE_EXHAUSTED|high demand|overloaded|INTERNAL|DEADLINE/i.test(message);
}

/** This model doesn't exist or can't do this request: skip straight to the next one. */
function isModelProblem(status: number, message: string) {
  return status === 404 || /not found|is not supported|no longer available|deprecated/i.test(message);
}

export interface GenerateOptions {
  /** Prefer the quicker lite models (used for agent chat turns). */
  fast?: boolean;
  /** Ask the model to spend less time reasoning before answering. */
  lowThinking?: boolean;
}

/**
 * generateContent with automatic fallback. Tries the preferred model first, retries a busy
 * model once after a short pause, then moves down the list. Errors like a bad API key are
 * thrown right away, since another model wouldn't fix them.
 */
export async function generate(
  params: Omit<GenerateContentParameters, "model">,
  opts: GenerateOptions = {},
): Promise<{ response: GenerateContentResponse; model: string }> {
  const pool = opts.fast
    ? [...MODELS.filter((m) => /lite/.test(m)), ...MODELS.filter((m) => !/lite/.test(m))]
    : MODELS;
  const start = opts.fast ? preferredFast : preferred;
  const order = [start, ...pool.filter((m) => m !== start)];
  const tried: string[] = [];

  for (const model of order) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const useLowThinking = opts.lowThinking && !thinkingUnsupported;
      const config = useLowThinking
        ? ({ ...params.config, thinkingConfig: { thinkingLevel: "LOW" } } as GenerateContentParameters["config"])
        : params.config;
      try {
        const response = await ai().models.generateContent({ ...params, config, model });
        if (model !== start) console.log(`[gemini] switched to ${model}`);
        if (opts.fast) preferredFast = model;
        else preferred = model;
        return { response, model };
      } catch (e) {
        const { status, message } = errorInfo(e);
        if (useLowThinking && /thinking/i.test(message)) {
          // This API version doesn't take the thinking setting: drop it and retry.
          thinkingUnsupported = true;
          attempt--;
          continue;
        }
        if (isModelProblem(status, message)) {
          console.warn(`[gemini] ${model} unavailable (${status || message.slice(0, 60)}), trying next model`);
          break;
        }
        if (!isTemporary(status, message)) throw e;
        console.warn(`[gemini] ${model} busy (${status || "error"})${attempt === 0 ? ", retrying" : ", trying next model"}`);
        if (attempt === 0) await new Promise((r) => setTimeout(r, 1200));
      }
    }
    tried.push(model);
  }
  throw new Error(
    `All Gemini models are busy right now (tried ${tried.join(", ")}). Wait a minute and try again.`,
  );
}

const AUDIENCES: Record<Audience, string> = {
  beginner: "a curious high-school student with no background in the field",
  student: "an undergraduate computer science student",
  expert: "a researcher in an adjacent field who wants the technical core",
};

const str = { type: Type.STRING };
const strList = { type: Type.ARRAY, items: str };

// Structured output: Gemini must answer in exactly this shape, so the UI can render it.
const summarySchema = {
  type: Type.OBJECT,
  properties: {
    title: str,
    authors: strList,
    one_sentence: str,
    plain_explanation: str,
    problem: str,
    method: str,
    key_findings: strList,
    key_numbers: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: { value: str, label: str },
        required: ["value", "label"],
      },
    },
    limitations: strList,
    why_it_matters: str,
    difficulty: { type: Type.INTEGER },
    key_terms: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: { term: str, definition: str },
        required: ["term", "definition"],
      },
    },
    questions_to_ask: strList,
  },
  required: [
    "title", "authors", "one_sentence", "plain_explanation", "problem", "method",
    "key_findings", "key_numbers", "limitations", "why_it_matters", "difficulty",
    "key_terms", "questions_to_ask",
  ],
};

function summaryPrompt(audience: Audience) {
  return `You are a careful research assistant. Read the attached paper, including its
figures and tables, and summarize it for ${AUDIENCES[audience] ?? AUDIENCES.student}.

Rules:
- Stay faithful to the paper. Never invent results, numbers, or claims.
- one_sentence: the whole contribution in one sentence, under 30 words.
- key_findings: 3-5 concrete results, using the paper's own numbers where given.
- key_numbers: 2-4 headline numbers copied exactly from the paper, each with a short
  label (under 8 words). Use an empty list if the paper has no headline numbers.
- limitations: ones the authors state, plus obvious ones they don't (small sample,
  single dataset, no baseline); start those with "Not stated by the authors:".
- difficulty: 1-5, how hard the ORIGINAL paper is to read for this audience.
- key_terms: 4-8 terms the reader must know, each defined in one plain sentence.
- questions_to_ask: 3 sharp questions a reader could ask to go deeper.
- If something is unclear or missing in the paper, say so rather than guessing.`;
}

/** Upload a PDF to the Files API and wait until Gemini has processed it. */
export async function uploadPdf(bytes: ArrayBuffer): Promise<PaperFile> {
  const blob = new Blob([bytes], { type: "application/pdf" });
  let file = await ai().files.upload({ file: blob, config: { mimeType: "application/pdf" } });

  for (let i = 0; i < 30 && file.state === FileState.PROCESSING; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    file = await ai().files.get({ name: file.name! });
  }
  if (file.state === FileState.FAILED || !file.uri) {
    throw new Error("Gemini couldn't process that PDF. Try another file.");
  }
  return { uri: file.uri, mimeType: file.mimeType || "application/pdf" };
}

export async function summarize(paper: PaperFile, audience: Audience): Promise<PaperSummary> {
  const { response } = await generate({
    contents: [createPartFromUri(paper.uri, paper.mimeType), summaryPrompt(audience)],
    config: { responseMimeType: "application/json", responseSchema: summarySchema },
  });
  const summary = JSON.parse(response.text ?? "{}") as PaperSummary;
  summary.difficulty = Math.min(5, Math.max(1, Math.round(summary.difficulty || 3)));
  return summary;
}

export async function askAboutPaper(paper: PaperFile, question: string, history: ChatTurn[]) {
  const convo = history
    .slice(-8)
    .map((t) => `${t.role.toUpperCase()}: ${t.text}`)
    .join("\n");

  const prompt = `Answer the reader's question using only the attached paper.
Name the section, table or figure you rely on. If the paper doesn't answer it,
say so plainly, then give general background labeled "General background:".
Keep it under 180 words. Plain text, no markdown headings.

Conversation so far:
${convo || "(none)"}

QUESTION: ${question}`;

  const { response } = await generate({
    contents: [createPartFromUri(paper.uri, paper.mimeType), prompt],
  });
  return response.text ?? "";
}

/** arxiv.org/abs/XXXX -> arxiv.org/pdf/XXXX; other links pass through. */
export function toPdfUrl(url: string) {
  const m = url.trim().match(/^https?:\/\/(?:www\.)?arxiv\.org\/(?:abs|pdf)\/([^?#]+?)(?:\.pdf)?$/);
  return m ? `https://arxiv.org/pdf/${m[1]}` : url.trim();
}

export async function downloadPdf(url: string): Promise<ArrayBuffer> {
  const res = await fetch(toPdfUrl(url), { headers: { "User-Agent": "paper-decoder/1.0" } });
  if (!res.ok) throw new Error(`Couldn't download that link (HTTP ${res.status}).`);
  const bytes = await res.arrayBuffer();
  if (bytes.byteLength > MAX_PDF_BYTES) throw new Error("That PDF is larger than 50 MB.");
  if (!isPdf(bytes)) throw new Error("That link didn't return a PDF. Try the direct PDF link.");
  return bytes;
}

export function isPdf(bytes: ArrayBuffer) {
  const head = new Uint8Array(bytes.slice(0, 4));
  return String.fromCharCode(...head) === "%PDF";
}
