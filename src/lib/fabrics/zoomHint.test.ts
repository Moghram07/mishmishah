import { describe, expect, it } from "vitest";
import { fabricById, fabrics } from "@/lib/data/fabrics";
import { fabricSurface } from "./patterns";
import { printKeep } from "./printScale";
import { SHOWS_AT, detailsOf, zoomWouldShow } from "./zoomHint";

/**
 * «كبّر لرؤية النقشة» — only where zooming in really shows something. Screen
 * pixels a centimetre, as the stages give them (see `frameFor`): a desktop
 * stage about 4.7 at 1× and 38 at 8×; a phone's about 1.3 at 1× and 10 at 8×.
 */
const DESKTOP = { at1: 4.7, at4: 19, most: 38 };
const PHONE = { at1: 1.3, at4: 5, most: 10 };
const f = (id: string) => fabricById(id)!;

describe("the zoom hint", () => {
  it("is never shown over a plain cloth with nothing more to show — a cotton, a crepe, a nida, a satin", () => {
    for (const id of ["fb-white", "fb-cream", "fb-black-crepe", "fb-burgundy-crepe", "fb-black-nida", "fb-ivory-satin", "fb-black-crepe-satin"]) {
      expect(detailsOf(f(id)), id).toEqual([]);
      for (const now of [0.5, 1.3, 4.7, 19]) expect(zoomWouldShow(f(id), now, 38), `${id} at ${now} px/cm`).toBe(false);
    }
  });

  it("asks for a close-up of a print too small to read, and not of one already sharp", () => {
    // a 2 cm stripe: a few pixels a repeat at 1× on a phone, sharp at 8× — and already sharp at 1× on a desktop, nine pixels a repeat
    expect(zoomWouldShow(f("fb-saffron-stripe"), PHONE.at1, PHONE.most)).toBe(true);
    expect(zoomWouldShow(f("fb-saffron-stripe"), DESKTOP.at1, DESKTOP.most)).toBe(false);
    // a 1 cm herringbone is too small at 1× on either
    expect(zoomWouldShow(f("fb-grey-herringbone"), DESKTOP.at1, DESKTOP.most)).toBe(true);
    // a 24 cm bloom is already sharp at 1×
    expect(zoomWouldShow(f("fb-ivory-roses"), DESKTOP.at1, DESKTOP.most)).toBe(false);
  });

  it("asks for a close-up of a surface only where the closest view shows it: a denim's streaks and a wool's flecks, a knit's columns on a desktop but not a phone", () => {
    for (const id of ["fb-denim-classic", "fb-indigo-denim", "fb-winter-grey", "fb-red-tartan"]) {
      expect(zoomWouldShow(f(id), DESKTOP.at1, DESKTOP.most), `${id} on a desktop`).toBe(true);
    }
    // a knit's columns, a millimetre and a half apart: at 8× a desktop brings them out, a phone never
    const knit = f("fb-grey-jersey");
    const columns = fabricSurface(knit)!.detailCm;
    expect(printKeep(columns * DESKTOP.most)).toBeGreaterThanOrEqual(SHOWS_AT);
    expect(zoomWouldShow(knit, DESKTOP.at4, DESKTOP.most)).toBe(true);
    expect(printKeep(columns * PHONE.most)).toBeLessThan(SHOWS_AT);
    expect(zoomWouldShow(knit, PHONE.at1, PHONE.most)).toBe(false);
    // and once a surface is sharp where it is, nothing more to ask
    expect(zoomWouldShow(f("fb-indigo-denim"), DESKTOP.most, DESKTOP.most)).toBe(false);
    // nor at the closest view, sharp or not: on a phone at 8× a denim's streaks are half drawn, and there is no closer
    expect(printKeep(fabricSurface(f("fb-indigo-denim"))!.detailCm * PHONE.most)).toBeLessThan(1);
    expect(zoomWouldShow(f("fb-indigo-denim"), PHONE.most, PHONE.most)).toBe(false);
    expect(zoomWouldShow(f("fb-saffron-stripe"), PHONE.most, PHONE.most)).toBe(false);
  });

  it("knows every fabric's details: its print if it has one, its surface if it has one", () => {
    for (const x of fabrics) {
      const surface = fabricSurface(x);
      for (const cm of detailsOf(x)) expect(cm, x.id).toBeGreaterThan(0);
      if (surface) expect(detailsOf(x), x.id).toContain(surface.detailCm);
    }
  });
});
