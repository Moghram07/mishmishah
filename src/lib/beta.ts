/**
 * The beta notice. Closing it is kept in the browser, so it stays closed on
 * the next visit; the small «تجريبي / Beta» badge by the logo stays always.
 *
 * Plain `.ts` (no "use client"): the root layout puts `betaInitScript` in the
 * page's <head>, where it marks the page before it paints — a closed notice
 * never flashes up and away again.
 */

export const BETA_BANNER_KEY = "mishmishah:beta-banner";

/** The mark on <html> that hides the notice (see `globals.css`). */
export const BETA_CLOSED_ATTR = "data-beta-closed";

export const betaInitScript = `(function(){try{if(localStorage.getItem('${BETA_BANNER_KEY}')==='closed')document.documentElement.setAttribute('${BETA_CLOSED_ATTR}','');}catch(e){}})();`;
