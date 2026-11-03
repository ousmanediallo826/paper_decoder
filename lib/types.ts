export type Audience = "beginner" | "student" | "expert";

export interface KeyTerm {
  term: string;
  definition: string;
}

export interface KeyNumber {
  value: string; // e.g. "28.4 BLEU"
  label: string; // e.g. "English→German translation score"
}

export interface PaperSummary {
  title: string;
  authors: string[];
  one_sentence: string;
  plain_explanation: string;
  problem: string;
  method: string;
  key_findings: string[];
  key_numbers: KeyNumber[];
  limitations: string[];
  why_it_matters: string;
  difficulty: number; // 1-5, how hard the original is to read
  key_terms: KeyTerm[];
  questions_to_ask: string[];
}

/** Reference to the PDF stored in Gemini's Files API. The client holds it, so the server stays stateless. */
export interface PaperFile {
  uri: string;
  mimeType: string;
}

export interface ChatTurn {
  role: "user" | "model";
  text: string;
}

// ---------- Research Room (multi-agent) ----------
export type AgentId = "doubt" | "scout" | "tinker" | "coach";

export interface Source {
  title: string;
  uri: string;
}

export interface AgentMessage {
  agent: AgentId;
  round: number;
  text: string;
  sources?: Source[];
}

export interface NextStep {
  when: string;   // "This week", "This month"...
  action: string;
  why: string;
}

export interface OpenProblem {
  title: string;
  why_it_matters: string;
  attack: string;       // why there's a reasonable way in right now
  first_step: string;
  difficulty: number;   // 1-5
  skills: string[];
  fit: string;          // why it suits this reader
}

export interface RoomPlan {
  headline: string;
  next_steps: NextStep[];
  problems: OpenProblem[];
}

/** Events streamed from /api/agents, one JSON object per line. */
export type RoomEvent =
  | { type: "typing"; agent: AgentId; round: number }
  | { type: "message"; message: AgentMessage }
  | { type: "plan"; plan: RoomPlan }
  | { type: "error"; message: string }
  | { type: "done" };
