/**
 * @file connectPopover.js 顶栏「连接 / 素材 / 界面 / 状态」汉堡菜单：相对 viewport 定位、互斥展开、
 * Escape 关闭。连接按钮为 UI 占位；「刷新」仅刷新 BLE 设备下拉数据。 */
import { getCurrentLocale, t } from "../localization/i18n.js";
import {
  getJson as getLocalizationJson,
  postJson as postLocalizationJson,
} from "../network/LocalizationAPI.js";

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
  let knownDevices = [];

  const setBluetoothState = (state) => {
    if (typeof window !== "undefined") {
      window.magosStatusPanel?.setConnectionState?.(state);
    }
  };

  const renderDeviceOptions = (devices, preserveValue) => {
    if (!deviceSelect) return;
    const list = Array.isArray(devices) ? devices : [];
    const normalized = list
      .map((item) => {
        if (item == null) return null;
        if (typeof item === "string") {
          const text = item.trim();
          return text
            ? {
                value: text,
                label: text,
                name: text,
                address: text,
              }
            : null;
        }
        if (typeof item === "object") {
          const address = String(item.address ?? "").trim();
          const name = String(item.name ?? "").trim();
          const fallback = address || name;
          if (!fallback) return null;
          const labelBase = name || address;
          return {
            value: address || name,
            label: labelBase,
            name: name || address,
            address: address || name,
          };
        }
        const text = String(item).trim();
        return text
          ? {
              value: text,
              label: text,
              name: text,
              address: text,
            }
          : null;
      })
      .filter(Boolean);
    knownDevices = normalized;
    deviceSelect.innerHTML = normalized
      .map((device) => `<option value="${device.value}">${device.label}</option>`)
      .join("");
    if (normalized.length === 0) return;
    const values = normalized.map((x) => x.value);
    if (preserveValue && values.includes(preserveValue)) {
      deviceSelect.value = preserveValue;
    } else {
      deviceSelect.value = normalized[0].value;
    }
  };

  const fetchAndRenderDevices = async () => {
    const res = await getLocalizationJson("/BLE_Refresh");
    if (!res.ok) {
      throw new Error(`BLE_Refresh failed: HTTP ${res.statusCode}`);
    }
    const payload = res.data;
    const list = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.data)
        ? payload.data
        : Array.isArray(payload?.list)
          ? payload.list
          : [];
    const preserveValue = deviceSelect?.value ?? "";
    renderDeviceOptions(list, preserveValue);
  };

  if (connectToggleBtn) {
    let connected = false;
    let busy = false;
    connectToggleBtn.dataset.connected = "false";
    connectToggleBtn.textContent = t("connect_connect", getCurrentLocale());
    connectToggleBtn.addEventListener("click", async () => {
      if (busy) return;
      busy = true;
      connectToggleBtn.disabled = true;
      try {
        if (!connected) {
          const selectedValue = String(deviceSelect?.value ?? "").trim();
          const selectedDevice =
            knownDevices.find((d) => d.value === selectedValue) || null;
          const name = String(selectedDevice?.name ?? selectedValue).trim();
          const address = String(selectedDevice?.address ?? selectedValue).trim();
          if (!name || !address) {
            throw new Error("未选择可连接设备");
          }
          setBluetoothState(2);
          const res = await postLocalizationJson("/BLE_Connect", { name, address });
          if (!res.ok) {
            throw new Error(`BLE_Connect failed: HTTP ${res.statusCode}`);
          }
          connected = true;
          connectToggleBtn.dataset.connected = "true";
          connectToggleBtn.textContent = t("connect_disconnect", getCurrentLocale());
        } else {
          const res = await getLocalizationJson("/BLE_Disconnect");
          if (!res.ok) {
            throw new Error(`BLE_Disconnect failed: HTTP ${res.statusCode}`);
          }
          connected = false;
          connectToggleBtn.dataset.connected = "false";
          connectToggleBtn.textContent = t("connect_connect", getCurrentLocale());
          setBluetoothState(1);
        }
      } catch (err) {
        console.warn("[connectPopover] 连接状态切换失败", err);
        document.dispatchEvent(new CustomEvent("magos:ble-state-switch-error", { detail: { error: err } }));
      } finally {
        busy = false;
        connectToggleBtn.disabled = false;
      }
    });
  }

  if (refreshBtn) {
    refreshBtn.addEventListener("click", async () => {
      refreshBtn.disabled = true;
      const prevText = refreshBtn.textContent;
      refreshBtn.textContent = `${t("connect_refresh", getCurrentLocale())}...`;
      try {
        await fetchAndRenderDevices();
      } catch (err) {
        console.warn("[connectPopover] BLE_Refresh 获取设备列表失败", err);
      } finally {
        refreshBtn.disabled = false;
        refreshBtn.textContent = prevText || t("connect_refresh", getCurrentLocale());
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

