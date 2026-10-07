// ucode's events, turned into what a chat shows: steps, the reply as it is written, questions.

import { type Event, type Item, type Step, newId } from "./data";

const lastSteps = (items: Item[]) => {
  const last = items.at(-1);
  return last?.kind === "steps" ? last : null;
};

function addStep(items: Item[], step: Step): Item[] {
  const group = lastSteps(items);
  if (group) return [...items.slice(0, -1), { ...group, steps: [...group.steps, step] }];
  // ponytail: times are when the window saw the events, so a replayed turn reads ~0s (and the duration is hidden).
  return [...items, { kind: "steps", id: newId(), steps: [step], start: Date.now() }];
}

/** One event applied to a chat's items. Events that are not about the chat's content leave it alone. */
export function apply(items: Item[], e: Event): Item[] {
  const text = typeof e.text === "string" ? e.text : "";
  switch (e.type) {
    case "user":
      return [...items, { kind: "user", id: newId(), text, files: (e.files as string[]) ?? [] }];
    case "step":
      return addStep(items, { text });
    case "narrate":
      return addStep(items, { text, narration: true });
    case "stepDone": {
      const group = lastSteps(items);
      if (!group || !group.steps.length) return items;
      const steps = [...group.steps];
      // The step that finished: the last real one, not a note or a line of narration said after it began.
      let at = steps.length - 1;
      while (at > 0 && (steps[at].narration || steps[at].detail)) at--;
      steps[at] = { ...steps[at], result: text, ok: e.ok !== false };
      return [...items.slice(0, -1), { ...group, steps, end: Date.now() }];
    }
    case "streamBegin":
      return [...items, { kind: "reply", id: newId(), text: "", streaming: true }];
    case "delta": {
      const last = items.at(-1);
      if (last?.kind !== "reply" || !last.streaming) return [...items, { kind: "reply", id: newId(), text, streaming: true }];
      return [...items.slice(0, -1), { ...last, text: last.text + text }];
    }
    case "streamDrop": {
      const last = items.at(-1);
      return last?.kind === "reply" && last.streaming ? items.slice(0, -1) : items;
    }
    case "streamEnd": {
      const last = items.at(-1);
      if (last?.kind !== "reply" || !last.streaming) return text.trim() ? [...items, { kind: "reply", id: newId(), text }] : items;
      return text.trim() ? [...items.slice(0, -1), { ...last, text, streaming: false }] : items.slice(0, -1);
    }
    case "reply":
      return text.trim() ? [...items, { kind: "reply", id: newId(), text }] : items;
    case "note":
    case "line":
      if (!text.trim()) return items;
      // Said while working (a deploy's "Live at…"): part of the steps, shown when they are opened.
      if (lastSteps(items)?.steps.length) return addStep(items, { text, detail: true });
      return [...items, { kind: "note", id: newId(), text }];
    case "lines":
    case "panel":
      return [...items, { kind: "lines", id: newId(), title: e.title as string | undefined, lines: (e.lines as string[]) ?? [] }];
    case "question":
      return [...items, {
        kind: "question", id: newId(), qid: e.id as string, ask: e.kind as "confirm" | "pick",
        action: e.action as string, detail: e.detail as string, risk: e.risk as string | null, always: e.always as string | null,
        title: e.title as string | null, items: e.items as string[],
      }];
    case "answered":
      return items.map((i) => (i.kind === "question" && i.qid === e.id ? { ...i, answered: true } : i));
    case "error":
      return [...items, { kind: "error", id: newId(), text, fix: e.fix as string | undefined }];
    default:
      return items;
  }
}

/** A saved chat, as the server reads it back. */
export function fromTranscript(list: { role: string; text?: string; count?: number }[]): Item[] {
  return list.map((m) =>
    m.role === "user" ? { kind: "user" as const, id: newId(), text: m.text ?? "" }
      : m.role === "ucode" ? { kind: "reply" as const, id: newId(), text: m.text ?? "" }
        : { kind: "steps" as const, id: newId(), steps: [], count: m.count ?? 0 },
  );
}
