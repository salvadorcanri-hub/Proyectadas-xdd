// Load before styles in every entry point, including the static landing page.
(() => {
  const key = 'edupuntos.appearance';
  const system = window.matchMedia('(prefers-color-scheme: dark)');
  const normalize = value => value === 'light' || value === 'dark' ? value : 'system';
  const read = () => {
    try { return normalize(localStorage.getItem(key)); }
    catch { return 'system'; }
  };
  let preference = read();
  const apply = () => {
    const root = document.documentElement;
    root.dataset.themePreference = preference;
    root.dataset.theme = preference === 'system' ? (system.matches ? 'dark' : 'light') : preference;
    document.querySelectorAll('[data-theme-select]').forEach(select => { select.value = preference; });
  };
  apply();
  document.addEventListener('DOMContentLoaded', apply, { once: true });
  document.addEventListener('change', event => {
    if (!(event.target instanceof HTMLSelectElement) || !event.target.matches('[data-theme-select]')) return;
    preference = normalize(event.target.value);
    try {
      if (preference === 'system') localStorage.removeItem(key);
      else localStorage.setItem(key, preference);
    } catch { /* Keep the choice for this page when storage is unavailable. */ }
    apply();
  });
  system.addEventListener('change', () => { if (preference === 'system') apply(); });
  window.addEventListener('storage', event => {
    if (event.key === key || event.key === null) { preference = read(); apply(); }
  });
})();
