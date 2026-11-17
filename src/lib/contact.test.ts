import { describe, expect, it } from "vitest";
import { SHOP_CONTACT, SHOP_JOIN, shopJoinMailto } from "./contact";

describe("a shop joining, until shop accounts exist", () => {
  it("is an email to the owner, its subject filled in", () => {
    const href = shopJoinMailto();
    const [to, query] = href.slice("mailto:".length).split("?");
    expect(to).toBe("omarmoghram@gmail.com");
    expect(decodeURIComponent(query.replace(/^subject=/, ""))).toBe("انضمام محل إلى مشمشة");
    expect(SHOP_JOIN.subject).toBe("انضمام محل إلى مشمشة");
  });

  it("leaves the shops' own contact empty until it is given — never made up", () => {
    expect(SHOP_CONTACT).toEqual({ whatsapp: "", email: "" });
  });
});
