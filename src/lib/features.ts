/**
 * Parts of the site that are built but not offered yet. Each is one switch:
 * its code and tests stay in place, and turning it on brings it back.
 */
export const FEATURES: {
  /**
   * Home products: the sofa, chair, pillow and curtain. Off while Mishmishah
   * is clothes-only. On, it brings back the visualizer's Home tab and the
   * Furniture and Curtains categories. The site's wording is written for
   * clothes only, so look it over when this comes back.
   */
  home: boolean;
} = {
  home: false,
};
