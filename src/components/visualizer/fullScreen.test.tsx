import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ComponentProps } from "react";
import { I18nProvider } from "@/lib/i18n/I18nProvider";
import { PhoneLayout } from "./PhoneLayout";

/**
 * The phone's full-screen view: «ملء الشاشة» under the share button in the
 * editor; on the whole screen, the panel and every control but the close-up's
 * put away, and «رجوع» in the top corner with «مشاركة» beside it. The page
 * renders in English first.
 */
const props = (full: boolean): ComponentProps<typeof PhoneLayout> =>
  ({
    title: "Visualizer",
    stage: <svg />,
    setStageEl: () => {},
    moverRef: null,
    moverSize: null,
    moverScale: 1,
    gestures: { onPointerDown: () => {}, onPointerMove: () => {}, onPointerUp: () => {}, onPointerCancel: () => {} },
    zoom: 2,
    narrow: false,
    onZoom: () => {},
    onWhole: () => {},
    note: "trueScale",
    body: { label: "Body", bodies: [{ id: "female", label: "Female" }], active: "female", onPick: () => {} },
    skin: { label: "Skin tone", tones: [{ id: "t3", label: "Tone 3", color: "#b98a73" }], active: "t3", onPick: () => {} },
    undo: () => {},
    redo: () => {},
    canUndo: true,
    canRedo: false,
    share: () => {},
    exporting: false,
    notice: null,
    close: () => {},
    full,
    onFull: () => {},
    onBack: () => {},
    tabs: [{ id: "cut", label: "Cut" }],
    tab: "cut",
    onTab: () => {},
    categories: [],
    category: undefined,
    onCategory: () => {},
    editing: null,
    next: null,
    fabrics: null,
  });
const markup = (full: boolean) => renderToStaticMarkup(<I18nProvider><PhoneLayout {...props(full)} /></I18nProvider>);

describe("the phone's full-screen view", () => {
  it("is offered in the editor, in words, under the share button: nothing put away, no way back", () => {
    const html = markup(false);
    expect(html).toContain("Full screen");
    // on a phone the picture is shared, not saved — desktop keeps «حفظ صورة»
    expect(html).toContain(">Share<");
    expect(html).not.toContain("Save image");
    expect(html).not.toContain(">Back<");
    expect(html).toMatch(/<section aria-label="Visualizer" class="(?![^"]*\bhidden\b)[^"]*"/);
  });

  it("puts the panel and every control but the close-up's away, with «رجوع» in the top corner and «مشاركة» beside it", () => {
    const html = markup(true);
    expect(html).toContain(">Back<");
    // sharing, in the same corner as the way back: the design seen big is the moment to send it
    const corner = /<div class="absolute start-3 top-3 flex gap-2">(.*?)<\/div>/.exec(html)?.[1] ?? "";
    expect(corner).toContain(">Back<");
    expect(corner).toContain(">Share<");
    expect(html).toMatch(/<section aria-label="Visualizer" class="[^"]*\bhidden\b[^"]*"/);
    // the editor's top corners, and undo and redo, are put away
    expect(html, "save, close and the whole screen's own button").toMatch(/<div class="absolute end-3 top-3 [^"]*\bhidden\b/);
    expect(html, "the mannequin and the size note").toMatch(/<div class="absolute start-3 top-3 [^"]*\bhidden\b/);
    expect(html, "undo and redo").toMatch(/<div class="absolute bottom-3 start-3 [^"]*\bhidden\b/);
    expect(html).not.toContain('aria-label="Skin tone');
    // the close-up and the way back to the whole figure stay
    expect(html).toContain('aria-label="Close-up: 2×"');
    expect(html).toContain("Whole figure");
  });
});
