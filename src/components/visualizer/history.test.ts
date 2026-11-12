import { describe, expect, it } from "vitest";
import { HISTORY_LIMIT, historyReducer, type History, type HistoryAction } from "./history";

type S = { sleeve: string; collar?: string };
const start: History<S> = { past: [], present: { sleeve: "short" }, future: [] };
const run = (h: History<S>, ...actions: HistoryAction<S>[]) => actions.reduce(historyReducer<S>, h);
const set = (next: Partial<S>): HistoryAction<S> => ({ type: "set", next: (s) => ({ ...s, ...next }) });

describe("undo and redo", () => {
  it("takes each choice back one step, and puts it back", () => {
    let h = run(start, set({ sleeve: "long" }), set({ collar: "sailor" }));
    expect(h.present).toEqual({ sleeve: "long", collar: "sailor" });
    h = run(h, { type: "undo" });
    expect(h.present).toEqual({ sleeve: "long" });
    h = run(h, { type: "undo" });
    expect(h.present).toEqual({ sleeve: "short" });
    // nothing further back: no change
    expect(run(h, { type: "undo" })).toBe(h);
    h = run(h, { type: "redo" }, { type: "redo" });
    expect(h.present).toEqual({ sleeve: "long", collar: "sailor" });
    expect(run(h, { type: "redo" })).toBe(h);
  });

  it("forgets what was undone once a new choice is made", () => {
    const h = run(start, set({ sleeve: "long" }), { type: "undo" }, set({ collar: "peter-pan" }));
    expect(h.future).toEqual([]);
    expect(run(h, { type: "redo" })).toBe(h);
  });

  it("makes no step of a tap on the choice already made", () => {
    const h = run(start, set({ sleeve: "long" }));
    // a new object with the same content: the same design
    expect(run(h, set({ sleeve: "long" }))).toBe(h);
  });

  it("keeps the last 50 steps", () => {
    let h = start;
    for (let i = 0; i < HISTORY_LIMIT + 10; i++) h = run(h, set({ sleeve: `s${i}` }));
    expect(HISTORY_LIMIT).toBe(50);
    expect(h.past).toHaveLength(HISTORY_LIMIT);
    for (let i = 0; i < HISTORY_LIMIT; i++) h = run(h, { type: "undo" });
    expect(h.present).toEqual({ sleeve: "s9" });
    expect(run(h, { type: "undo" })).toBe(h);
  });

  it("starts afresh on a rebase, with nothing to undo or redo", () => {
    const h = run(start, set({ sleeve: "long" }), set({ collar: "sailor" }), { type: "undo" }, { type: "rebase", next: () => ({ sleeve: "elbow" }) });
    expect(h).toEqual({ past: [], present: { sleeve: "elbow" }, future: [] });
  });
});
