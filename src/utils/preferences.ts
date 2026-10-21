// Reader preferences: theme, font and text size. One table describes every option.
//
// A preference is stored as a `data-<name>` attribute on <html>, and global.css reacts to it. The default value
// has no attribute at all, so a page with no stored preferences is exactly the unmodified stylesheet (light, system
// font, medium size). The same table is inlined into <head> (see BaseHead.astro) so the choice is applied before
// the first paint; that is what prevents a flash of the wrong theme.

export const PREFERENCES_KEY = 'reading-prefs';

export const PREFERENCE_OPTIONS = {
  theme: { default: 'light', values: ['light', 'dark'] },
  font: { default: 'system', values: ['system', 'sans', 'serif', 'mono'] },
  size: { default: 'medium', values: ['small', 'medium', 'large', 'xlarge'] },
} as const;

export type PreferenceName = keyof typeof PREFERENCE_OPTIONS;
export type Preferences = { [N in PreferenceName]: (typeof PREFERENCE_OPTIONS)[N]['values'][number] };

/** Sets or clears the `data-*` attributes. Unknown or default values clear the attribute. */
export function applyPreferences(root: HTMLElement, prefs: Partial<Record<string, string>>): void {
  for (const [name, option] of Object.entries(PREFERENCE_OPTIONS)) {
    const value = prefs[name];
    if (value && value !== option.default && (option.values as readonly string[]).includes(value)) {
      root.dataset[name] = value;
    } else {
      delete root.dataset[name];
    }
  }
}

/** The effective preferences of a page, read back from its attributes. */
export function readPreferences(root: HTMLElement): Preferences {
  const result: Record<string, string> = {};
  for (const [name, option] of Object.entries(PREFERENCE_OPTIONS)) {
    result[name] = root.dataset[name] ?? option.default;
  }
  return result as Preferences;
}

/**
 * Source of the inline script that applies stored preferences before first paint. It cannot import this module
 * (it runs in <head>, before any bundle), so the table is serialized into it.
 */
export function earlyPreferencesScript(): string {
  const table = JSON.stringify(
    Object.fromEntries(Object.entries(PREFERENCE_OPTIONS).map(([name, o]) => [name, { d: o.default, v: o.values }])),
  );
  return `try{var p=JSON.parse(localStorage.getItem(${JSON.stringify(PREFERENCES_KEY)})||'{}'),t=${table},r=document.documentElement;for(var n in t){var v=p[n];if(v&&v!==t[n].d&&t[n].v.indexOf(v)>-1)r.dataset[n]=v}}catch(e){}`;
}
