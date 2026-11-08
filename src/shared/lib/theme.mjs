/** Keep system/app theme matching by default; explicit override is local to this device. */
export const THEME_KEY = 'uspu:theme-preference:v2';
export const THEMES = ['auto', 'light', 'dark'];
export function sanitizeThemePreference(value) {
  return THEMES.includes(value) ? value : 'auto';
}
export function resolveTheme(preference, deviceTheme) {
  return sanitizeThemePreference(preference) === 'auto'
    ? (deviceTheme === 'dark' ? 'dark' : 'light')
    : preference;
}
