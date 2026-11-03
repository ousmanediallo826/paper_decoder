"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import demoRoom from "@/lib/demo-room.json";
import type { AgentId, AgentMessage, PaperFile, PaperSummary, RoomEvent, RoomPlan } from "@/lib/types";

// Mirrors lib/agents.ts (kept here so the client bundle never imports server code).
const AGENTS: Record<AgentId, { name: string; role: string; does: string; glyph: string }> = {
  doubt: { name: "Dr. Doubt", role: "Reviewer", does: "Finds the weak spots", glyph: "?" },
  scout: { name: "Scout", role: "Field scout", does: "Searches what came after", glyph: "↗" },
  tinker: { name: "Tinker", role: "Builder", does: "Turns ideas into projects", glyph: "#" },
  coach: { name: "Coach", role: "Mentor", does: "Writes your plan", glyph: "★" },
};
const ORDER: AgentId[] = ["doubt", "scout", "tinker", "coach"];
const ROUND_TITLES: Record<number, string> = { 1: "Round 1 · First takes", 2: "Round 2 · They push back" };

const DEMO = demoRoom as { profile: string; messages: AgentMessage[]; plan: RoomPlan };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function ResearchRoom({ summary, paper, isDemo }: { summary: PaperSummary; paper: PaperFile | null; isDemo: boolean }) {
  const [profile, setProfile] = useState(isDemo ? DEMO.profile : "");
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [typing, setTyping] = useState<AgentId[]>([]); // agents in a round write at the same time
  const [plan, setPlan] = useState<RoomPlan | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);

  function handle(e: RoomEvent) {
    if (!alive.current) return;
    if (e.type === "typing") setTyping((t) => (t.includes(e.agent) ? t : [...t, e.agent]));
    else if (e.type === "message") {
      setMessages((m) => [...m, e.message]);
      setTyping((t) => t.filter((a) => a !== e.message.agent));
    }
    else if (e.type === "plan") { setPlan(e.plan); setTyping([]); }
    else if (e.type === "error") { setError(e.message); setTyping([]); }
  }

  async function replayDemo() {
    // Same rhythm as the live room: a whole round starts typing at once, answers land one by one.
    for (const round of [1, 2]) {
      const batch = DEMO.messages.filter((m) => m.round === round);
      batch.forEach((m) => handle({ type: "typing", agent: m.agent, round }));
      for (const message of batch) {
        await sleep(900);
        handle({ type: "message", message });
      }
    }
    handle({ type: "typing", agent: "coach", round: 3 });
    await sleep(1200);
    handle({ type: "plan", plan: DEMO.plan });
  }

  async function streamLive() {
    const res = await fetch("/api/agents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file: paper, summary, profile }),
    });
    if (!res.ok || !res.body) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "The agents couldn't start. Try again.");
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let nl: number;
      while ((nl = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (line) handle(JSON.parse(line) as RoomEvent);
      }
    }
  }

  async function convene() {
    setMessages([]); setPlan(null); setError(""); setRunning(true);
    try {
      if (isDemo || !paper) await replayDemo();
      else await streamLive();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      if (alive.current) { setRunning(false); setTyping([]); }
    }
  }

  const started = running || messages.length > 0;

  return (
    <section className="room" aria-label="Research Room">
      <div className="room-head">
        <span className="kicker">Multi-agent mode</span>
        <h3 className="room-title">The Research Room</h3>
        <p className="room-lede">
          Four AI agents debate this paper, challenge each other and fact-check ideas with Google Search.
          Then Coach tells you what to do next and which important problems you could help solve.
        </p>
      </div>

      <div className="roster">
        {ORDER.map((id) => (
          <div key={id} className={`agent-card${typing.includes(id) ? " speaking" : ""}`}>
            <Avatar id={id} />
            <div className="agent-meta">
              <b>{AGENTS[id].name}</b>
              <span>{AGENTS[id].does}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="sticker brief">
        <label htmlFor="profile" className="field-label">Tell the agents about you</label>
        <textarea
          id="profile"
          rows={2}
          value={profile}
          onChange={(e) => setProfile(e.target.value)}
          placeholder="e.g. CS junior, good at Python, some C++, about 5 hours a week, interested in systems"
        />
        <button type="button" className="btn btn-primary" onClick={convene} disabled={running}>
          {running ? "Agents are talking…" : started ? "Run it again" : "Convene the agents →"}
        </button>
      </div>

      {error && <div className="error" role="alert">{error}</div>}

      {started && (
        <div className="chat" aria-live="polite">
          {messages.map((m, i) => (
            <Fragment key={i}>
              {(i === 0 || messages[i - 1].round !== m.round) && <div className="round">{ROUND_TITLES[m.round] ?? `Round ${m.round}`}</div>}
              <Bubble message={m} />
            </Fragment>
          ))}
          {typing.map((id) => (
            <div key={`typing-${id}`} className={`bubble ${id}`}>
              <Avatar id={id} />
              <div className="bubble-body">
                <div className="bubble-name"><b>{AGENTS[id].name}</b><span>{id === "coach" ? "writing your plan" : id === "scout" ? "searching the web" : "typing"}</span></div>
                <div className="dots" aria-label="typing"><i /><i /><i /></div>
              </div>
            </div>
          ))}
        </div>
      )}

      {plan && <Plan plan={plan} />}
    </section>
  );
}

function Avatar({ id }: { id: AgentId }) {
  return <span className={`avatar av-${id}`} aria-hidden="true">{AGENTS[id].glyph}</span>;
}

/** Bold any agent name mentioned in the text, so the back-and-forth is easy to follow. */
function withMentions(text: string) {
  const names = ORDER.map((id) => AGENTS[id].name.replace(".", "\\."));
  const parts = text.split(new RegExp(`(${names.join("|")})`, "g"));
  return parts.map((p, i) => (names.some((n) => new RegExp(`^${n}$`).test(p)) ? <b key={i} className="mention">@{p}</b> : p));
}

function Bubble({ message: m }: { message: AgentMessage }) {
  return (
    <div className={`bubble ${m.agent}`}>
      <Avatar id={m.agent} />
      <div className="bubble-body">
        <div className="bubble-name"><b>{AGENTS[m.agent].name}</b><span>{AGENTS[m.agent].role}</span></div>
        <p>{withMentions(m.text)}</p>
        {m.sources && m.sources.length > 0 && (
          <div className="sources">
            <span>Searched:</span>
            {m.sources.map((s) => <a key={s.uri} href={s.uri} target="_blank" rel="noreferrer">{s.title}</a>)}
          </div>
        )}
      </div>
    </div>
  );
}

function Plan({ plan }: { plan: RoomPlan }) {
  return (
    <div className="plan">
      <div className="plan-head">
        <Avatar id="coach" />
        <div>
          <span className="kicker">Coach's verdict</span>
          <p className="plan-headline">{plan.headline}</p>
        </div>
      </div>

      <h4 className="plan-sub">Your next moves</h4>
      <ol className="timeline">
        {plan.next_steps.map((s, i) => (
          <li key={i}>
            <span className="when">{s.when}</span>
            <b>{s.action}</b>
            <span className="why">{s.why}</span>
          </li>
        ))}
      </ol>

      <h4 className="plan-sub">Important problems you could help solve</h4>
      <div className="problems">
        {plan.problems.map((p, i) => (
          <article key={i} className="sticker problem">
            <div className="problem-top">
              <span className="rank">{i === 0 ? "Best fit" : `Option ${i + 1}`}</span>
              <span className="pips small" aria-label={`Difficulty ${p.difficulty} of 5`}>
                {[1, 2, 3, 4, 5].map((n) => <span key={n} className={n <= p.difficulty ? "on" : ""} />)}
              </span>
            </div>
            <h5>{p.title}</h5>
            <dl>
              <dt>Why it matters</dt><dd>{p.why_it_matters}</dd>
              <dt>Why now</dt><dd>{p.attack}</dd>
              <dt>Why you</dt><dd>{p.fit}</dd>
            </dl>
            <div className="first-step"><b>Start this week:</b> {p.first_step}</div>
            <div className="skills">{p.skills.map((s) => <span key={s}>{s}</span>)}</div>
          </article>
        ))}
      </div>
    </div>
  );
}
