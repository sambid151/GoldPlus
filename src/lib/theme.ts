export type Theme = "light" | "dark";

export const THEME_KEY = "goldpulse-theme";

/** The theme actually showing: an explicit choice (data-theme attribute) wins, otherwise the system setting. */
export function resolveTheme(attribute: string | null | undefined, systemPrefersDark: boolean): Theme {
  if (attribute === "light" || attribute === "dark") return attribute;
  return systemPrefersDark ? "dark" : "light";
}

export const oppositeTheme = (t: Theme): Theme => (t === "dark" ? "light" : "dark");

/**
 * Runs in <head> before first paint so a saved choice never flashes the wrong theme.
 * Only "light" and "dark" are accepted; anything else (or blocked storage) leaves the system setting in charge.
 */
export const themeInitScript = `try{var t=localStorage.getItem(${JSON.stringify(THEME_KEY)});if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}`;
