import type { PaperSummary } from "./types";

/** Sample result so the UI works with no API key (handy for judges and bad Wi-Fi). */
export const DEMO_SUMMARY: PaperSummary = {
  title: "Attention Is All You Need",
  authors: [
    "Ashish Vaswani", "Noam Shazeer", "Niki Parmar", "Jakob Uszkoreit",
    "Llion Jones", "Aidan N. Gomez", "Łukasz Kaiser", "Illia Polosukhin",
  ],
  one_sentence:
    "The Transformer drops recurrence entirely and uses only attention to translate text, beating the best models while training far faster.",
  plain_explanation:
    "Before this paper, translation models read a sentence one word at a time, like reading through a straw. The Transformer looks at every word at once and learns which other words each one should pay attention to. Because nothing has to wait for the previous word, the work splits across GPUs easily, so training is much faster. This design later became the base of GPT, Gemini and almost every modern language model.",
  problem:
    "Recurrent networks process words in order, so training can't be parallelized within a sentence and long-range connections between distant words are hard to learn.",
  method:
    "An encoder-decoder built only from stacked self-attention and feed-forward layers. Multi-head attention lets the model look at different relationships at once, and positional encodings tell it word order.",
  key_findings: [
    "28.4 BLEU on WMT 2014 English-to-German, more than 2 BLEU above the previous best, ensembles included.",
    "41.8 BLEU on WMT 2014 English-to-French, a new single-model state of the art.",
    "The big model trained in 3.5 days on 8 P100 GPUs, a small fraction of the training cost of earlier top models.",
    "The same architecture also did well on English constituency parsing, so it isn't limited to translation.",
  ],
  key_numbers: [
    { value: "28.4", label: "BLEU, English→German" },
    { value: "41.8", label: "BLEU, English→French" },
    { value: "3.5 days", label: "training on 8 GPUs" },
  ],
  limitations: [
    "Self-attention cost grows with the square of the sequence length, which the authors flag for very long inputs.",
    "Tested mainly on translation and one parsing task.",
    "Not stated by the authors: results rely on large compute and heavy hyperparameter tuning that small labs may not reproduce.",
  ],
  why_it_matters:
    "It introduced the Transformer, the architecture behind today's large language models, image models and code assistants.",
  difficulty: 4,
  key_terms: [
    { term: "Self-attention", definition: "Each word scores how relevant every other word is, then mixes in their information by those scores." },
    { term: "Multi-head attention", definition: "Several attention operations run side by side, each free to focus on a different kind of relationship." },
    { term: "Encoder-decoder", definition: "One stack reads the input sentence; the other writes the output sentence while looking back at it." },
    { term: "Positional encoding", definition: "Patterns added to each word so the model knows its position, since attention alone ignores order." },
    { term: "BLEU", definition: "A score from 0 to 100 measuring how closely a machine translation matches human ones." },
    { term: "Recurrence", definition: "Processing a sequence step by step, where each step depends on the one before it." },
  ],
  questions_to_ask: [
    "Why does dividing by √dₖ in scaled dot-product attention matter?",
    "Which ablations hurt performance the most?",
    "How do sinusoidal and learned positional encodings compare here?",
  ],
};
