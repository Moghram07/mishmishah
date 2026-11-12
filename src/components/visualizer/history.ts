import { useCallback, useReducer } from "react";

/**
 * Undo and redo for the visualizer: every choice is one step back.
 *
 * A reducer rather than a ref, so React can run it twice (it does, in
 * development) without a step being recorded twice: a step is a pure function
 * of the history and the change asked for.
 */

/** How many steps back can be taken. Enough for a session of trying things; small enough to hold. */
export const HISTORY_LIMIT = 50;

export interface History<T> {
  /** Oldest first: undo takes the last one. */
  past: T[];
  present: T;
  /** Nearest first: redo takes the first one. */
  future: T[];
}

export type HistoryAction<T> =
  /** A choice: one step, which also forgets anything undone before it. */
  | { type: "set"; next: (present: T) => T }
  | { type: "undo" }
  | { type: "redo" }
  /** A new starting point with nothing to undo — the visualizer opening on a new fabric. */
  | { type: "rebase"; next: (present: T) => T };

/**
 * Whether two states are the same design. The states are plain data, so
 * their JSON is a fair test, and it is what keeps a tap on the choice already
 * made from becoming a step that undoes nothing.
 */
const same = <T,>(a: T, b: T): boolean => a === b || JSON.stringify(a) === JSON.stringify(b);

export function historyReducer<T>(h: History<T>, action: HistoryAction<T>): History<T> {
  switch (action.type) {
    case "set": {
      const next = action.next(h.present);
      if (same(next, h.present)) return h;
      return { past: [...h.past, h.present].slice(-HISTORY_LIMIT), present: next, future: [] };
    }
    case "undo": {
      if (h.past.length === 0) return h;
      return { past: h.past.slice(0, -1), present: h.past[h.past.length - 1], future: [h.present, ...h.future] };
    }
    case "redo": {
      if (h.future.length === 0) return h;
      return { past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1) };
    }
    case "rebase":
      return { past: [], present: action.next(h.present), future: [] };
  }
}

/** A state with undo and redo — see `historyReducer`. */
export function useHistory<T>(start: () => T) {
  const [h, dispatch] = useReducer(historyReducer<T>, undefined, () => ({ past: [], present: start(), future: [] }));
  const set = useCallback((next: (present: T) => T) => dispatch({ type: "set", next }), []);
  const rebase = useCallback((next: (present: T) => T) => dispatch({ type: "rebase", next }), []);
  const undo = useCallback(() => dispatch({ type: "undo" }), []);
  const redo = useCallback(() => dispatch({ type: "redo" }), []);
  return { state: h.present, set, rebase, undo, redo, canUndo: h.past.length > 0, canRedo: h.future.length > 0 };
}
