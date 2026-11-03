// Research Room: four Gemini agents discuss a paper, challenge each other,
// then a mentor turns the debate into a plan for the reader.
//
// Speed: agents in the same round write at the same time (Promise.all), so a run is
// 3 waits instead of 7. Chat turns use the fast lite models with low thinking and work
// from the summary instead of re-reading the PDF. Only Coach uses the stronger model.
import { Type } from "@google/genai";
import { generate } from "./gemini";
import type { AgentId, AgentMessage, PaperFile, PaperSummary, RoomEvent, RoomPlan, Source } from "./types";

export const AGENTS: Record<AgentId, { name: string; role: string; persona: string }> = {
  doubt: {
    name: "Dr. Doubt",
    role: "Reviewer",
    persona:
      "a sharp but fair peer reviewer. You hunt for untested assumptions, weak evaluations and claims that outrun the evidence. You are never rude, and you always say how a weakness could be fixed.",
  },
  scout: {
    name: "Scout",
    role: "Field scout",
    persona:
      "a researcher who knows the literature. You use Google Search to find what happened after this paper: follow-up work, what got solved, what is still open. You name specific papers or projects with years, and you only claim what your search results support.",
  },
  tinker: {
    name: "Tinker",
    role: "Builder",
    persona:
      "a hands-on engineer. You turn ideas into concrete projects sized to the reader's skills and weekly time, with clear deliverables. You are enthusiastic but you take criticism well.",
  },
  coach: {
    name: "Coach",
    role: "Mentor",
    persona:
      "a research mentor who follows Richard Hamming's advice: work on important problems, but only ones where there is a reasonable attack; plant many small seeds; build on others' work; and do work others can use.",
  },
};

interface Turn {
  agent: AgentId;
  round: number;
  task: string;
  search?: boolean; // ground with Google Search
}

// Each inner list runs in parallel; the next round sees everything said before it.
const ROUNDS: Turn[][] = [
  [
    {
      agent: "doubt", round: 1,
      task: "Open the discussion. Name the 2-3 most important weaknesses, untested assumptions or open questions in this paper. Under 110 words.",
    },
    {
      agent: "scout", round: 1, search: true,
      task: "Search the web for what happened after this paper. Which of its limitations were later addressed, by whom, and which problems are still open today? Under 130 words.",
    },
    {
      agent: "tinker", round: 1,
      task: "Propose 2-3 concrete projects the reader could build or reproduce, sized to their background and time, aimed at the paper's limitations and open questions. Number them. Under 130 words.",
    },
  ],
  [
    {
      agent: "doubt", round: 2,
      task: "Push back on Tinker's ideas using what Scout found. Which is most likely to be trivial, already done, or to fail, and how could the best one become a real contribution? Address Tinker by name. Under 100 words.",
    },
    {
      agent: "scout", round: 2, search: true,
      task: "Check novelty: search whether Tinker's strongest idea has already been done. Report what you found and where a gap remains. Address Tinker by name. Under 100 words.",
    },
  ],
];

function context(summary: PaperSummary, profile: string) {
  return `PAPER: "${summary.title}" by ${summary.authors.slice(0, 3).join(", ")}${summary.authors.length > 3 ? " et al." : ""}
Summary: ${summary.one_sentence}
Problem: ${summary.problem}
Method: ${summary.method}
Findings: ${summary.key_findings.join(" | ")}
Stated limitations: ${summary.limitations.join(" | ")}

THE READER (who you are helping): ${profile || "A computer science student with a few hours a week. Background not specified."}`;
}

function transcriptText(messages: AgentMessage[]) {
  if (!messages.length) return "(nobody has spoken yet; the others are writing their first takes at the same time as you)";
  return messages.map((m) => `${AGENTS[m.agent].name} (round ${m.round}): ${m.text}`).join("\n\n");
}

function sourcesFrom(response: unknown): Source[] {
  type Chunk = { web?: { uri?: string; title?: string } };
  const r = response as { candidates?: { groundingMetadata?: { groundingChunks?: Chunk[] } }[] };
  const chunks = r?.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
  const seen = new Set<string>();
  const out: Source[] = [];
  for (const c of chunks) {
    const web = c?.web;
    if (web?.uri && !seen.has(web.uri)) {
      seen.add(web.uri);
      out.push({ uri: web.uri, title: web.title || web.uri });
    }
  }
  return out.slice(0, 5);
}

async function speak(turn: Turn, summary: PaperSummary, profile: string, transcript: AgentMessage[]) {
  const me = AGENTS[turn.agent];
  const others = (Object.keys(AGENTS) as AgentId[]).filter((id) => id !== turn.agent).map((id) => AGENTS[id].name).join(", ");
  const prompt = `You are ${me.name}, ${me.persona}
You are in a group chat with ${others}, helping one reader understand a paper and decide what to work on.

${context(summary, profile)}

TRANSCRIPT SO FAR:
${transcriptText(transcript)}

YOUR TURN: ${turn.task}
Speak in first person, conversational, like a chat message. Refer to the others by name when you react to them.
Plain text only: no markdown headings, no bold, no bullet symbols.`;

  const { response } = await generate(
    { contents: [prompt], config: turn.search ? { tools: [{ googleSearch: {} }] } : undefined },
    { fast: true, lowThinking: true },
  );
  const message: AgentMessage = { agent: turn.agent, round: turn.round, text: (response.text ?? "").trim() };
  if (turn.search) message.sources = sourcesFrom(response);
  return message;
}

const str = { type: Type.STRING };
const planSchema = {
  type: Type.OBJECT,
  properties: {
    headline: str,
    next_steps: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: { when: str, action: str, why: str },
        required: ["when", "action", "why"],
      },
    },
    problems: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: str, why_it_matters: str, attack: str, first_step: str,
          difficulty: { type: Type.INTEGER },
          skills: { type: Type.ARRAY, items: str },
          fit: str,
        },
        required: ["title", "why_it_matters", "attack", "first_step", "difficulty", "skills", "fit"],
      },
    },
  },
  required: ["headline", "next_steps", "problems"],
};

async function coach(summary: PaperSummary, profile: string, messages: AgentMessage[]): Promise<RoomPlan> {
  const prompt = `You are ${AGENTS.coach.name}, ${AGENTS.coach.persona}
You have just read the team's discussion. Turn it into a plan for the reader.

${context(summary, profile)}

TEAM DISCUSSION:
${transcriptText(messages)}

Write:
- headline: one sentence of advice for this reader, under 25 words.
- next_steps: 4 steps in order, each with when ("This week", "Next 2 weeks", "This month", "This semester"),
  a concrete action, and why it matters. Start with understanding, end with something public others can use.
- problems: 3 important open problems from the discussion that this reader could realistically contribute to.
  Only include problems the team actually raised. For each: why it matters, why there is a reasonable
  attack right now, a first step they can take this week, difficulty 1-5 for this reader, skills needed,
  and why it fits this reader. Order from most to least promising for them.
Be honest: if a problem is a stretch for the reader, say so in "fit".`;

  const { response } = await generate({
    contents: [prompt],
    config: { responseMimeType: "application/json", responseSchema: planSchema },
  });
  const plan = JSON.parse(response.text ?? "{}") as RoomPlan;
  plan.problems?.forEach((p) => (p.difficulty = Math.min(5, Math.max(1, Math.round(p.difficulty || 3)))));
  return plan;
}

// Same paper + same "about you" text = same discussion, so reruns come back instantly.
const cache = new Map<string, { messages: AgentMessage[]; plan: RoomPlan }>();

/** Runs the whole room, emitting events as each agent finishes so the UI can stream the chat. */
export async function runRoom(
  paper: PaperFile,
  summary: PaperSummary,
  profile: string,
  emit: (e: RoomEvent) => void,
) {
  const key = `${paper.uri}|${profile.trim().toLowerCase()}`;
  const hit = cache.get(key);
  if (hit) {
    hit.messages.forEach((message) => emit({ type: "message", message }));
    emit({ type: "plan", plan: hit.plan });
    emit({ type: "done" });
    return;
  }

  const messages: AgentMessage[] = [];
  for (const round of ROUNDS) {
    const seen = [...messages]; // everyone in this round reacts to the same transcript
    round.forEach((t) => emit({ type: "typing", agent: t.agent, round: t.round }));
    await Promise.all(
      round.map(async (turn) => {
        const message = await speak(turn, summary, profile, seen);
        messages.push(message);
        emit({ type: "message", message }); // shows up as soon as this agent is done
      }),
    );
  }

  emit({ type: "typing", agent: "coach", round: 3 });
  const plan = await coach(summary, profile, messages);
  emit({ type: "plan", plan });
  emit({ type: "done" });

  cache.set(key, { messages, plan });
  if (cache.size > 20) cache.delete(cache.keys().next().value!);
}
