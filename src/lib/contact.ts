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

/** A chat with that number in WhatsApp — the app on a phone, WhatsApp Web elsewhere. */
export const whatsappLink = (number: string) => `https://wa.me/${number.replace(/\D/g, "")}`;
