# Paper Decoder

Feed it any research paper (PDF upload or arXiv link). Gemini reads the whole
thing, figures and tables included, and returns a playful, structured breakdown:

- the paper in one sentence, highlighted
- headline numbers as big stat stickers
- the problem, what they did, and what they found
- **The fine print**: limitations, including ones the authors didn't mention
- **Decoder ring**: flip cards for the jargon
- **Ask the paper**: follow-up chat grounded in the PDF
- three reading levels: New to this / Student / Expert
- **Research Room**: four AI agents debate the paper, push back on each other,
  fact-check with Google Search, then tell you what to do next and which
  important open problems you could help solve
- **Try a famous paper** button: a demo result that works with no API key

## Run it

```bash
npm install
cp .env.example .env.local      # then paste your key into .env.local
npm run dev
```

Get a free key at https://aistudio.google.com/apikey and open http://localhost:3000.
Test link: https://arxiv.org/abs/1706.03762

## If a model is busy

Every Gemini call goes through `generate()` in `lib/gemini.ts`. When a model
answers "high demand" (503), rate-limited (429) or "not found" (404), the app
retries once, then moves to the next model in `GEMINI_MODELS` and remembers
the one that worked. The terminal logs `[gemini] switched to ...` when it happens.

## How it uses Gemini

| Feature | Gemini API capability |
|---|---|
| Reads charts and tables, not only text | Native PDF document understanding |
| Follow-up questions reuse the paper | Files API (uploads kept 48 hours) |
| UI gets clean sections every time | Structured output with a JSON schema |
| Reading levels | Prompt adapts to the target reader |
| Agents check what happened after the paper | Grounding with Google Search |
| Agent chat appears message by message | Streaming NDJSON from a route handler |

## The Research Room (multi-agent)

| Agent | Job |
|---|---|
| **Dr. Doubt** (Reviewer) | Finds weak spots and untested assumptions, then pushes back on project ideas |
| **Scout** (Field scout) | Uses Google Search to find follow-up work and check whether an idea is already done |
| **Tinker** (Builder) | Turns open problems into projects sized to your skills and weekly time |
| **Coach** (Mentor) | Reads the whole debate and writes your plan: next steps plus 3 open problems ranked by fit |

The agents share one transcript, so every turn reacts to the ones before it:

```
Round 1: Doubt critiques + Scout searches what came after + Tinker proposes projects   (in parallel)
Round 2: Doubt attacks the ideas + Scout searches for novelty   (in parallel)
Final:   Coach -> structured plan (next steps + problems you could solve)
```

That's 6 Gemini calls in 3 waves: agents in the same round write at the same time on fast models, and only Coach uses the strongest one. Rerunning with the same paper and profile is instant. Tell the agents about your
skills and time in the box first: the plan changes with it. The orchestration
lives in `lib/agents.ts`; edit `TURNS` to add agents or rounds.

The server is stateless: the browser keeps the Files API reference and sends it
with each question, so it deploys to Vercel as-is.

## Project map

```
app/page.tsx              the whole UI (client component)
app/globals.css           the risograph-zine design
app/api/summarize/route.ts  upload PDF -> Files API -> structured summary
app/api/ask/route.ts      follow-up questions about the same paper
app/api/agents/route.ts   streams the Research Room conversation
app/ResearchRoom.tsx      group-chat UI, plan timeline, problem cards
lib/agents.ts             agent personas, turn order, Coach's plan schema
lib/demo-room.json        recorded demo conversation (works with no key)
lib/gemini.ts             all Gemini calls, prompts and the schema
lib/demo.ts               sample result for the demo button
```

## Deploying to Vercel

Add `GEMINI_API_KEY` in Project Settings → Environment Variables.
The Research Room route asks for up to 300 seconds; Vercel's free plan may cap
functions lower, so if it times out, cut the round-2 turns in `lib/agents.ts`.
Vercel limits request bodies to about 4.5 MB, so on Vercel use arXiv links for
big papers (the server downloads those itself) or upload smaller PDFs.

## Stretch ideas

- **Paper vs. paper**: send two PDFs in one request and compare them.
- **Listen mode**: turn the summary into a 2-minute audio briefing with Gemini TTS.
- **Quiz me**: generate 5 questions to check understanding.
- **Explain this figure**: let users pick a page and ask about one chart.
