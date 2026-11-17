import { describe, expect, it } from "vitest";
import { DESIGN_LINE_MAX, FEEDBACK_EMAIL, FEEDBACK_SUBJECT, designLine, feedbackMailto, onDesignLine, setDesignLine } from "./feedback";

describe("the feedback link", () => {
  const parts = (href: string) => {
    const [to, query] = href.slice("mailto:".length).split("?");
    return { to, query: Object.fromEntries(query.split("&").map((kv) => kv.split("=").map(decodeURIComponent))) };
  };

  it("opens an email to the owner with the subject filled in", () => {
    expect(FEEDBACK_EMAIL).toBe("omarmoghram@gmail.com");
    const { to, query } = parts(feedbackMailto());
    expect(to).toBe("omarmoghram@gmail.com");
    expect(query.subject).toBe("ملاحظات على نسخة مشمشة التجريبية");
    expect(FEEDBACK_SUBJECT).toBe(query.subject);
    // nothing looked at yet: no body
    expect(query.body).toBeUndefined();
  });

  it("opens the body with the design line, then a line to write under", () => {
    const line = "التصميم: فستان (فتحة الرقبة: مربعة) — الأقمشة: فستان: كتّان طبيعي";
    const { query } = parts(feedbackMailto(line));
    expect(query.body).toBe(`${line}\r\n\r\n`);
    // spaces and Arabic encoded, never a raw "&" or "#" that would cut the link short
    expect(feedbackMailto("a & b # c")).toContain("body=a%20%26%20b%20%23%20c");
    // a very long one is cut, so every mail app still takes the link
    const long = parts(feedbackMailto("x".repeat(5000))).query.body;
    expect(long.length).toBeLessThanOrEqual(DESIGN_LINE_MAX + 4);
  });

  it("keeps the design last looked at, telling the links only when it changes", () => {
    let told = 0;
    const off = onDesignLine(() => told++);
    setDesignLine("one");
    setDesignLine("one");
    expect([designLine(), told]).toEqual(["one", 1]);
    setDesignLine("two");
    expect([designLine(), told]).toEqual(["two", 2]);
    off();
    setDesignLine("three");
    expect(told).toBe(2);
    setDesignLine(null);
  });
});
