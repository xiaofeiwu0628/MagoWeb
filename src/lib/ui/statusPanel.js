/**
 * statusPanel.js — 「状态」面板内蓝牙圆点与电量文案的演示状态切换（占位逻辑）
 */
import { getCurrentLocale, t } from "../i18n.js";

const STATE_KEYS = {
  1: "status_bt_state_1",
  2: "status_bt_state_2",
  3: "status_bt_state_3",
};

let connectionState = 1;
let batteryPercent = 100;

function syncPanelAria() {
  const panel = document.getElementById("execute-hamburger-panel");
  if (panel) {
    panel.setAttribute("aria-label", t("status_panel_aria", getCurrentLocale()));
  }
}

function applyConnectionUI() {
  const dot = document.getElementById("bluetooth-status-dot");
  const label = document.getElementById("bluetooth-status-text");
  if (!dot || !label) return;
  const s = [1, 2, 3].includes(connectionState) ? connectionState : 1;
  dot.dataset.state = String(s);
  dot.classList.remove("is-state-1", "is-state-2", "is-state-3");
  dot.classList.add(`is-state-${s}`);
  const key = STATE_KEYS[s];
  label.textContent = t(key, getCurrentLocale());
}

function applyBatteryUI() {
  const el = document.getElementById("bluetooth-battery-value");
  if (!el) return;
  const n = Math.max(0, Math.min(100, Math.round(Number(batteryPercent))));
  el.textContent = String(n).padStart(3, "0");
}

/**
 * 蓝牙连接状态：1 红 / 2 黄 / 3 绿，文案随语言包变化。
 * @param {1|2|3} state
 */
export function setBluetoothConnectionState(state) {
  const s = Number(state);
  if (![1, 2, 3].includes(s)) return;
  connectionState = s;
  applyConnectionUI();
}

/**
 * 电量 0–100，显示为三位数 000–100。
 * @param {number} percent
 */
export function setBluetoothBatteryLevel(percent) {
  batteryPercent = percent;
  applyBatteryUI();
}

function onLocaleChanged() {
  syncPanelAria();
  applyConnectionUI();
}

export function setupStatusPanel() {
  document.addEventListener("magos:locale-changed", onLocaleChanged);
  syncPanelAria();
  applyConnectionUI();
  applyBatteryUI();

  if (typeof window !== "undefined") {
    window.magosStatusPanel = {
      setConnectionState: setBluetoothConnectionState,
      setBatteryLevel: setBluetoothBatteryLevel,
    };
  }
}
