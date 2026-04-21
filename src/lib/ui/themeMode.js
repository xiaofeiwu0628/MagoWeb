/**
 * @file themeMode.js — 亮/暗主题：下拉 `#theme-style-select` 与 `body.theme-dark`、localStorage 同步。
 */
export function setupThemeMode({ selectId = "theme-style-select" } = {}) {
  const select = document.getElementById(selectId);
  if (!select) return;
  const storageKey = "magosmaster-theme-mode";

  const getBrowserPreferredMode = () => {
    return window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  };

  const getInitialMode = () => {
    const saved = localStorage.getItem(storageKey);
    if (saved === "light" || saved === "dark") return saved;
    return getBrowserPreferredMode();
  };

  const applyTheme = (mode) => {
    document.body.classList.toggle("theme-dark", mode === "dark");
    localStorage.setItem(storageKey, mode);
  };

  const initialMode = getInitialMode();
  select.value = initialMode;
  applyTheme(initialMode);
  select.addEventListener("change", () => applyTheme(select.value));
}
