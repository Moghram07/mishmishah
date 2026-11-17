import { FEEDBACK_EMAIL } from "@/lib/feedback";

/**
 * How fabric shops reach Mishmishah: WhatsApp first, email as the backup.
 *
 * Both are left empty until the real number and address are written here.
 * The "Contact us" button appears once `whatsapp` is set, and the email line
 * once `email` is, so the site never shows a contact that goes nowhere.
 */
export const SHOP_CONTACT = {
  /** WhatsApp number in international form, e.g. "9665XXXXXXXX" for a Saudi mobile. */
  whatsapp: "",
  /** The backup address. */
  email: "",
};

/**
 * Until shop accounts exist, a shop asks to join by email: «سجّل متجرك»
 * opens one to the owner (their address and subject, 2026-11-17). Not the
 * shops' contact above, which stays empty until it is given.
 */
export const SHOP_JOIN = { email: FEEDBACK_EMAIL, subject: "انضمام محل إلى مشمشة" } as const;

export const shopJoinMailto = () => `mailto:${SHOP_JOIN.email}?subject=${encodeURIComponent(SHOP_JOIN.subject)}`;

/** A chat with that number in WhatsApp — the app on a phone, WhatsApp Web elsewhere. */
export const whatsappLink = (number: string) => `https://wa.me/${number.replace(/\D/g, "")}`;
