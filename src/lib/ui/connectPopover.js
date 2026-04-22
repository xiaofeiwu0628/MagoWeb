/**
 * @file connectPopover.js 顶栏「连接 / 素材 / 界面 / 状态」汉堡菜单：相对 viewport 定位、互斥展开、
 * Escape 关闭。连接按钮为 UI 占位；「刷新」重置设备下拉并调用 `onReloadActions`（从 **标准使用数据**
 * `data/actions.js` 经 `reloadFromDataFile` 重载动作列表）。 */
import { getCurrentLocale, t } from "../localization/i18n.js";

export function setupConnectPopover({
  triggerId = "connect-nav-trigger",
  panelId = "connect-hamburger-panel",
  viewportSelector = ".viewport",
  deviceSelectId = "device-select",
  connectToggleId = "connect-toggle-btn",
  refreshBtnId = "refresh-btn",
  onReloadActions,
} = {}) {
  const viewport = document.querySelector(viewportSelector);
  const entries = [
    { trigger: document.getElementById(triggerId), panel: document.getElementById(panelId) },
    { trigger: document.getElementById("material-nav-trigger"), panel: document.getElementById("material-hamburger-panel") },
    { trigger: document.getElementById("ui-nav-trigger"), panel: document.getElementById("ui-hamburger-panel") },
    { trigger: document.getElementById("execute-nav-trigger"), panel: document.getElementById("execute-hamburger-panel") },
  ].filter((x) => x.trigger && x.panel);
  const deviceSelect = document.getElementById(deviceSelectId);
  const connectToggleBtn = document.getElementById(connectToggleId);
  const refreshBtn = document.getElementById(refreshBtnId);
  if (!viewport || entries.length === 0) return;

  const devices = ["device1", "device2", "device3"];
  if (deviceSelect) {
    deviceSelect.innerHTML = devices
      .map((device) => `<option value="${device}">${device}</option>`)
      .join("");
  }

  if (connectToggleBtn) {
    let connected = false;
    connectToggleBtn.dataset.connected = "false";
    connectToggleBtn.textContent = t("connect_connect", getCurrentLocale());
    connectToggleBtn.addEventListener("click", () => {
      connected = !connected;
      connectToggleBtn.dataset.connected = connected ? "true" : "false";
      connectToggleBtn.textContent = connected
        ? t("connect_disconnect", getCurrentLocale())
        : t("connect_connect", getCurrentLocale());
    });
  }

  if (refreshBtn) {
    refreshBtn.addEventListener("click", () => {
      if (typeof onReloadActions === "function") {
        onReloadActions();
      }
      if (deviceSelect) {
        const current = deviceSelect.value;
        deviceSelect.innerHTML = devices
          .map((device) => `<option value="${device}">${device}</option>`)
          .join("");
        deviceSelect.value = current || devices[0];
      }
    });
  }

  const positionPanel = (trigger, panel) => {
    const triggerRect = trigger.getBoundingClientRect();
    const viewportRect = viewport.getBoundingClientRect();
    const triggerCenterX = triggerRect.left + triggerRect.width / 2 - viewportRect.left;
    const panelWidth = panel.offsetWidth || 464;
    const arrowCenterOffset = 97;
    let left = triggerCenterX - arrowCenterOffset;
    const maxLeft = Math.max(0, viewportRect.width - panelWidth);
    left = Math.max(0, Math.min(left, maxLeft));
    const top = triggerRect.bottom - viewportRect.top + 8;
    panel.style.left = `${left}px`;
    panel.style.top = `${top}px`;
  };

  const closeAll = () => {
    entries.forEach(({ trigger, panel }) => {
      panel.hidden = true;
      trigger.setAttribute("aria-expanded", "false");
    });
  };

  const openPanel = (trigger, panel) => {
    positionPanel(trigger, panel);
    panel.hidden = false;
    trigger.setAttribute("aria-expanded", "true");
  };

  entries.forEach(({ trigger, panel }) => {
    trigger.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const willOpen = panel.hidden;
      closeAll();
      if (willOpen) openPanel(trigger, panel);
    });
  });

  entries.forEach(({ panel }) => {
    panel.addEventListener("click", (event) => {
      event.stopPropagation();
    });
  });

  document.addEventListener("click", () => {
    closeAll();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeAll();
  });

  window.addEventListener("resize", () => {
    entries.forEach(({ trigger, panel }) => {
      if (!panel.hidden) positionPanel(trigger, panel);
    });
  });
}

