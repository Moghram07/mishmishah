/**
 * Where a design sent as a link sits in the address: after `#d=`. Only the
 * part after the `#` — a browser never sends it to any server, so the design
 * stays between the one who sent it and the one who opens it.
 *
 * Kept apart from the link's reading (`designLink.ts`), which needs the whole
 * catalogue: this is all the page needs on its first load to notice a link
 * and open the visualizer, which brings the rest.
 */
export const DESIGN_HASH = "#d=";

/** The design in an address's `#` part, if it carries one. */
export const sentPayload = (hash: string): string | null =>
  hash.startsWith(DESIGN_HASH) ? hash.slice(DESIGN_HASH.length) : null;
