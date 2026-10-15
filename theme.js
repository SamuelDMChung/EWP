/* V1.7 — one browser-local appearance setting shared by all portal pages. */
(() => {
  'use strict';
  const KEY = 'ewp_management_display_theme_v17';
  function read() {
    try { return localStorage.getItem(KEY) === 'dark' ? 'dark' : 'light'; }
    catch { return 'light'; }
  }
  function apply(value, save=false) {
    const theme = value === 'dark' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-ewp-theme', theme);
    document.documentElement.style.colorScheme = theme;
    document.querySelectorAll('[data-ewp-theme-select]').forEach(select => { if (select.value !== theme) select.value = theme; });
    if (save) {
      try { localStorage.setItem(KEY, theme); } catch (error) { console.warn('Theme preference could not be saved',error); }
    }
  }
  window.EWPTheme = {apply, read};
  apply(read());
  window.addEventListener('storage', event => { if (event.key === KEY) apply(read()); });
  document.addEventListener('DOMContentLoaded', () => {
    apply(read());
    document.querySelectorAll('[data-ewp-theme-select]').forEach(select => {
      select.addEventListener('change', () => apply(select.value, true));
    });
  });
})();
