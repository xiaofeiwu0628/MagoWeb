/**
 * @file tabs.js — 通用 Tab：点击切换 `data-tab` / `data-panel` 对应面板的 class 与 `aria-selected`；
 * 可选 `storageKey` 持久化当前选中 tab（如顶栏编辑器子 tab）。
 */
export function setupThemeTabs({
  tabSelector = ".tabs__item[data-tab]",
  panelSelector = ".tab-panel[data-panel]",
  defaultTab = "action",
  activeTabClass = "tabs__item--active",
  activePanelClass = "tab-panel--active",
  manageAriaHidden = false,
  storageKey = "",
} = {}) {
  const tabButtons = Array.from(document.querySelectorAll(tabSelector));
  const panels = Array.from(document.querySelectorAll(panelSelector));
  if (tabButtons.length === 0 || panels.length === 0) return;

  const hasTab = (tab) =>
    tabButtons.some((btn) => btn.dataset.tab === tab) &&
    panels.some((panel) => panel.dataset.panel === tab);

  const getStoredTab = () => {
    if (!storageKey) return null;
    try {
      const saved = localStorage.getItem(storageKey);
      return hasTab(saved) ? saved : null;
    } catch {
      return null;
    }
  };

  const setStoredTab = (tab) => {
    if (!storageKey || !hasTab(tab)) return;
    try {
      localStorage.setItem(storageKey, tab);
    } catch {
      // Ignore storage failures (private mode / denied quota).
    }
  };

  const activate = (tab, { persist = true } = {}) => {
    tabButtons.forEach((btn) => {
      const isActive = btn.dataset.tab === tab;
      btn.classList.toggle(activeTabClass, isActive);
      btn.setAttribute("aria-selected", isActive ? "true" : "false");
    });

    panels.forEach((panel) => {
      const isActive = panel.dataset.panel === tab;
      panel.classList.toggle(activePanelClass, isActive);
      if (manageAriaHidden) {
        panel.setAttribute("aria-hidden", isActive ? "false" : "true");
      }
    });

    if (persist) setStoredTab(tab);
  };

  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => activate(btn.dataset.tab || defaultTab));
  });

  const initialTab = getStoredTab() ?? defaultTab;
  activate(initialTab, { persist: false });
}

