"use client";

import { useEffect, useRef, useState } from "react";
import { DEMO_SUMMARY } from "@/lib/demo";
import ResearchRoom from "./ResearchRoom";
import type { Audience, ChatTurn, PaperFile, PaperSummary } from "@/lib/types";

const LEVELS: { id: Audience; name: string; hint: string }[] = [
  { id: "beginner", name: "New to this", hint: "No jargon, real-life analogies" },
  { id: "student", name: "Student", hint: "Class-level background assumed" },
  { id: "expert", name: "Expert", hint: "Give me the technical core" },
];

const QUIPS = [
  "Skimming the abstract like everyone else…",
  "Squinting at Figure 3…",
  "Decoding the Greek letters…",
  "Reading the tables nobody reads…",
  "Checking what the authors didn't say…",
  "Bravely opening the appendix…",
];

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState("");
  const [audience, setAudience] = useState<Audience>("student");
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState<PaperSummary | null>(null);
  const [paper, setPaper] = useState<PaperFile | null>(null);
  const [isDemo, setIsDemo] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (summary) resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [summary]);

  async function decode() {
    if (!file && !url.trim()) return setError("Drop a PDF or paste a link to one first.");
    setError("");
    setLoading(true);
    setSummary(null);
    const body = new FormData();
    if (file) body.append("pdf", file);
    else body.append("url", url.trim());
    body.append("audience", audience);
    try {
      const res = await fetch("/api/summarize", { method: "POST", body });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSummary(data.summary);
      setPaper(data.file);
      setIsDemo(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  function loadDemo() {
    setError("");
    setSummary(DEMO_SUMMARY);
    setPaper(null);
    setIsDemo(true);
  }

  function pickFile(f: File | undefined) {
    if (!f) return;
    if (f.type !== "application/pdf") return setError("That file isn't a PDF.");
    setError("");
    setFile(f);
    setUrl("");
  }

  return (
    <main className="page">
      <header className="masthead">
        <span className="badge">
          Built with the <b>Gemini API</b>
        </span>
        <h1 className="title">
          Paper <span className="squiggle">Decoder</span>
        </h1>
        <p className="lede">
          Feed it any research paper. Get <mark>what it found</mark>, <mark>how they did it</mark> and{" "}
          <mark>what to doubt</mark>, explained at your level.
        </p>
      </header>

      <section className="sticker feeder" aria-label="Choose a paper">
        <label
          className={`drop${dragOver ? " over" : ""}`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); pickFile(e.dataTransfer.files[0]); }}
        >
          <input ref={inputRef} id="pdf" type="file" accept="application/pdf" onChange={(e) => pickFile(e.target.files?.[0])} />
          <DocIcon />
          <span className="drop-text">
            <strong>{file ? file.name : "Drop a PDF here"}</strong>
            <span>{file ? `${(file.size / 1024 / 1024).toFixed(1)} MB · click to swap` : "or click to choose one, up to 50 MB"}</span>
          </span>
        </label>

        <div className="or">or paste a link</div>
        <input
          id="url"
          className="url-input"
          type="url"
          placeholder="https://arxiv.org/abs/1706.03762"
          value={url}
          onChange={(e) => { setUrl(e.target.value); if (e.target.value) setFile(null); }}
          onKeyDown={(e) => e.key === "Enter" && decode()}
        />

        <span className="field-label" id="level-label">Explain it for</span>
        <div className="levels" role="group" aria-labelledby="level-label">
          {LEVELS.map((l) => (
            <button key={l.id} type="button" className="level" aria-pressed={audience === l.id} onClick={() => setAudience(l.id)}>
              <b>{l.name}</b>
              <small>{l.hint}</small>
            </button>
          ))}
        </div>

        <div className="actions">
          <button type="button" className="btn btn-primary" onClick={decode} disabled={loading}>
            {loading ? "Decoding…" : "Decode it →"}
          </button>
          <button type="button" className="btn btn-ghost" onClick={loadDemo} disabled={loading}>
            Try a famous paper
          </button>
        </div>
      </section>

      {error && <div className="error" role="alert">{error}</div>}
      {loading && <Loading />}

      {summary && (
        <div ref={resultsRef}>
          <Results summary={summary} isDemo={isDemo} paper={paper} />
        </div>
      )}

      <footer className="footer">Paper Decoder · summaries can miss nuance, so check the paper before you cite it</footer>
    </main>
  );
}

function Loading() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((n) => (n + 1) % QUIPS.length), 2200);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="sticker loading" role="status" aria-live="polite">
      <div className="scan-page" aria-hidden="true"><i /><i /><i /><i /><i /><i /></div>
      <div>
        <p className="quip">{QUIPS[i]}</p>
        <p className="quip-sub">Gemini is reading the whole PDF, figures included. Long papers take up to a minute.</p>
      </div>
    </div>
  );
}

function Results({ summary: s, isDemo, paper }: { summary: PaperSummary; isDemo: boolean; paper: PaperFile | null }) {
  return (
    <article className="results">
      {isDemo && <span className="demo-note">Demo result · no API call made</span>}

      <div className="sticker title-card">
        <h2 className="paper-title">{s.title}</h2>
        <p className="authors">{s.authors.join(", ")}</p>
        <div className="difficulty">
          <span>Original reading difficulty</span>
          <span className="pips" aria-label={`${s.difficulty} out of 5`}>
            {[1, 2, 3, 4, 5].map((n) => <span key={n} className={n <= s.difficulty ? "on" : ""} />)}
          </span>
        </div>
      </div>

      <p className="tldr">
        <span className="kicker">The whole paper in one sentence</span>
        <span className="hl">{s.one_sentence}</span>
      </p>

      {s.key_numbers.length > 0 && (
        <div className="numbers">
          {s.key_numbers.map((n, i) => (
            <div className="stat" key={i}><b>{n.value}</b><span>{n.label}</span></div>
          ))}
        </div>
      )}

      <section className="block plain">
        <h3>In plain words</h3>
        <p>{s.plain_explanation}</p>
      </section>

      <div className="flow">
        <section className="sticker step">
          <h3><em>1</em>The problem</h3>
          <p>{s.problem}</p>
        </section>
        <section className="sticker step">
          <h3><em>2</em>What they did</h3>
          <p>{s.method}</p>
        </section>
      </div>

      <section className="block">
        <h3>What they found</h3>
        <ol className="findings">{s.key_findings.map((f, i) => <li key={i}>{f}</li>)}</ol>
      </section>

      <section className="block fineprint">
        <h3>The fine print</h3>
        <ul>{s.limitations.map((l, i) => <li key={i}>{l}</li>)}</ul>
      </section>

      <section className="block matters">
        <h3>Why it matters</h3>
        <p>{s.why_it_matters}</p>
      </section>

      <section className="block">
        <div className="terms-head">
          <h3>Decoder ring</h3>
          <span>Tap a term to flip it</span>
        </div>
        <div className="terms">{s.key_terms.map((t) => <FlipCard key={t.term} term={t.term} definition={t.definition} />)}</div>
      </section>

      <Ask key={s.title} questions={s.questions_to_ask} paper={paper} isDemo={isDemo} />

      <ResearchRoom key={`${s.title}-${isDemo}`} summary={s} paper={paper} isDemo={isDemo} />
    </article>
  );
}

function FlipCard({ term, definition }: { term: string; definition: string }) {
  const [flipped, setFlipped] = useState(false);
  return (
    <button type="button" className="flip" aria-pressed={flipped} onClick={() => setFlipped((f) => !f)}
      aria-label={flipped ? `${term}: ${definition}` : `${term}, show definition`}>
      <div className="flip-inner">
        <div className="face front"><small>Term</small><b>{term}</b></div>
        <div className="face back">{definition}</div>
      </div>
    </button>
  );
}

function Ask({ questions, paper, isDemo }: { questions: string[]; paper: PaperFile | null; isDemo: boolean }) {
  const [history, setHistory] = useState<ChatTurn[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  async function ask(q: string) {
    const question = q.trim();
    if (!question || busy) return;
    setDraft("");
    const next: ChatTurn[] = [...history, { role: "user", text: question }];
    setHistory(next);

    if (isDemo || !paper) {
      setHistory([...next, { role: "model", text: "This is the demo result. Decode a real PDF with your Gemini API key and I'll answer from the paper itself." }]);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file: paper, question, history }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setHistory([...next, { role: "model", text: data.answer }]);
    } catch (e) {
      setHistory([...next, { role: "model", text: e instanceof Error ? e.message : "That didn't work. Try again." }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="sticker ask" aria-label="Ask about this paper">
      <h3 className="ask-title">Ask the paper</h3>
      <div className="chips">
        {questions.map((q) => <button key={q} type="button" className="chip" onClick={() => ask(q)}>{q}</button>)}
      </div>
      {history.length > 0 && (
        <div className="thread" aria-live="polite">
          {history.map((t, i) => <div key={i} className={`note ${t.role}`}>{t.text}</div>)}
          {busy && <div className="note model thinking">Flipping through the pages…</div>}
        </div>
      )}
      <form className="ask-form" onSubmit={(e) => { e.preventDefault(); ask(draft); }}>
        <textarea
          id="question"
          rows={1}
          placeholder="What dataset did they use?"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(draft); } }}
        />
        <button type="submit" className="btn btn-primary" disabled={busy}>Ask</button>
      </form>
    </section>
  );
}

function DocIcon() {
  return (
    <svg className="doc-icon" viewBox="0 0 56 68" aria-hidden="true">
      <path d="M6 3h30l15 15v45a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" fill="var(--surface)" stroke="var(--ink)" strokeWidth="2.5" />
      <path d="M36 3v15h15" fill="none" stroke="var(--ink)" strokeWidth="2.5" />
      <rect x="11" y="27" width="30" height="6" rx="2" fill="var(--yellow)" />
      <path d="M12 30h28M12 40h32M12 48h24M12 56h28" stroke="var(--ink)" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="44" cy="54" r="9" fill="var(--pink)" stroke="var(--ink)" strokeWidth="2.5" />
      <path d="M40 54h8M44 50v8" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}
