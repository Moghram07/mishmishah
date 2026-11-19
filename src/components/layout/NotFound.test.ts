import { describe, expect, it } from "vitest";
import { dictionaries } from "@/lib/i18n/dictionaries";

describe("the 404 page", () => {
  it("has its words in Arabic as well as English", () => {
    const ar: Record<string, string> = dictionaries.ar;
    const keys = Object.keys(dictionaries.en).filter((k) => k.startsWith("notFound."));
    expect(keys).toEqual(["notFound.title", "notFound.body", "notFound.home"]);
    for (const key of keys) {
      // a missing Arabic line would fall back to the English one, unnoticed
      expect(ar[key], key).toMatch(/[؀-ۿ]/);
      expect(ar[key], key).not.toMatch(/[A-Za-z]/);
    }
  });
});
