/**
 * Feedback on the beta, by email — no form, nothing kept on the site.
 *
 * The link opens the tester's own mail app on a message to the owner, the
 * subject filled in, and the body opening with one line saying what was on
 * the figure (garment, its main parts, its fabrics) so the feedback has its
 * context. They can delete the line. The address is shown as text beside a
 * copy button too, for a phone with no mail app set up.
 */

/** The owner's address — on the site at their request, for the beta's feedback only (not the shops' contact: see `lib/contact.ts`). */
export const FEEDBACK_EMAIL = "omarmoghram@gmail.com";

/** The subject, in Arabic whichever language the site is in, so every reply sorts together. */
export const FEEDBACK_SUBJECT = "ملاحظات على نسخة مشمشة التجريبية";

/** Long enough for any design; short enough that every mail app takes the link. */
export const DESIGN_LINE_MAX = 600;

/**
 * The `mailto:` link: the address, the subject, and the design line when there
 * is one, then an empty line to write under. Line breaks as CRLF, as a
 * `mailto:` body must carry them.
 */
export function feedbackMailto(line?: string | null): string {
  const query = [`subject=${encodeURIComponent(FEEDBACK_SUBJECT)}`];
  if (line) {
    const clipped = line.length > DESIGN_LINE_MAX ? `${line.slice(0, DESIGN_LINE_MAX - 1)}…` : line;
    query.push(`body=${encodeURIComponent(`${clipped}\r\n\r\n`)}`);
  }
  return `mailto:${FEEDBACK_EMAIL}?${query.join("&")}`;
}

/*
  The design last looked at, described in one line — set by whichever stage
  is showing it (the visualizer, the visualizer page), read by every feedback
  link. Kept outside React state so a change in the visualizer re-renders only
  the links, not everything that opens the visualizer.
*/
let current: string | null = null;
const listeners = new Set<() => void>();

export function setDesignLine(line: string | null) {
  if (line === current) return;
  current = line;
  for (const listener of listeners) listener();
}

export const designLine = () => current;

export function onDesignLine(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
