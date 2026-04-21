import "./styles/main.css";
import { initUiAssets } from "./lib/ui/uiAssets.js";
import { setupThemeTabs } from "./lib/ui/tabs.js";
import { getJson, postJson, putJson, deleteJson, patchJson } from "./lib/API.js";
import {
  initPreview,
  setBodyRotationZBySlider,
  setLeftbiRotationYBySlider,
  setLeftjianRotationXBySlider,
  setLefthandRotationYBySlider,
  setRightbiRotationYBySlider,
  setRightjianRotationXBySlider,
  setRighthandRotationYBySlider,
} from "./lib/threePreview.js";
import { setupThemeMode } from "./lib/ui/themeMode.js";
import { getCurrentLocale, setupI18n, t } from "./lib/i18n.js";
import { setupStatusPanel } from "./lib/ui/statusPanel.js";
import { setupJointControls } from "./lib/jointControl.js";
import { setupConnectPopover } from "./lib/ui/connectPopover.js";
import { actionList } from "./lib/actionList.js";
import {
  mountSubGalleryPanel,
  renderSubGallery,
  setupSubGallerySlider,
  setupSubGalleryPointerPan,
  setupSubGalleryDragReorder,
  wireGalleryActions,
} from "./lib/gallery.js";
import { setupActionDataManager } from "./lib/actionDataManager.js";

initUiAssets();
setupI18n();
setupStatusPanel();
setupThemeTabs();
setupThemeTabs({
  tabSelector: ".editor-top-tabs__btn[data-tab]",
  panelSelector: ".editor-panel[data-panel]",
  defaultTab: "action-group",
  activeTabClass: "editor-top-tabs__btn--active",
  activePanelClass: "editor-panel--active",
  manageAriaHidden: true,
  storageKey: "magosmaster-editor-active-tab",
});
setupThemeMode();
setupJointControls();

const musicFileInput = document.getElementById("editor-music-file-input");
const musicFileNameEl = document.getElementById("editor-music-file-name");
const syncMusicFileNameLabel = () => {
  if (!musicFileNameEl) return;
  const locale = getCurrentLocale();
  const file = musicFileInput?.files?.[0];
  if (file?.name) {
    musicFileNameEl.textContent = file.name;
    musicFileNameEl.classList.remove("is-empty");
  } else {
    musicFileNameEl.textContent = t("editor_music_no_file", locale);
    musicFileNameEl.classList.add("is-empty");
  }
};
if (musicFileInput && musicFileNameEl) {
  musicFileInput.addEventListener("change", syncMusicFileNameLabel);
  document.addEventListener("magos:locale-changed", syncMusicFileNameLabel);
  syncMusicFileNameLabel();
}

const root = document.getElementById("three-root");
const threePreviewApi = root ? initPreview(root) : null;

mountSubGalleryPanel();
const actionDataApi = setupActionDataManager({
  actionList,
  onListChanged: () => renderSubGallery(),
});
renderSubGallery();
setupSubGallerySlider();
setupSubGalleryPointerPan();
setupSubGalleryDragReorder();
wireGalleryActions(actionDataApi, { threePreview: threePreviewApi });

const slider1 = document.querySelector(
  ".joint-control[data-joint-control] .joint-control__slider",
);
if (slider1) {
  const syncBodyRoll = () => {
    const min = Number(slider1.getAttribute("min") ?? 0);
    const max = Number(slider1.getAttribute("max") ?? 180);
    setBodyRotationZBySlider(slider1.value, min, max);
  };
  slider1.addEventListener("input", syncBodyRoll);
  syncBodyRoll();
}

const sliders = Array.from(
  document.querySelectorAll(".joint-control[data-joint-control] .joint-control__slider"),
);
const slider2 = sliders[1];
if (slider2) {
  const syncLeftjianPitch = () => {
    const min = Number(slider2.getAttribute("min") ?? 0);
    const max = Number(slider2.getAttribute("max") ?? 180);
    setLeftjianRotationXBySlider(slider2.value, min, max);
  };
  slider2.addEventListener("input", syncLeftjianPitch);
  syncLeftjianPitch();
}

const slider3 = sliders[2];
if (slider3) {
  const syncLeftbiYaw = () => {
    const min = Number(slider3.getAttribute("min") ?? 0);
    const max = Number(slider3.getAttribute("max") ?? 180);
    setLeftbiRotationYBySlider(slider3.value, min, max);
  };
  slider3.addEventListener("input", syncLeftbiYaw);
  syncLeftbiYaw();
}

const slider4 = sliders[3];
if (slider4) {
  const syncLefthandYaw = () => {
    const min = Number(slider4.getAttribute("min") ?? 0);
    const max = Number(slider4.getAttribute("max") ?? 180);
    setLefthandRotationYBySlider(slider4.value, min, max);
  };
  slider4.addEventListener("input", syncLefthandYaw);
  syncLefthandYaw();
}

const slider5 = sliders[4];
if (slider5) {
  const syncRightjianPitch = () => {
    const min = Number(slider5.getAttribute("min") ?? 0);
    const max = Number(slider5.getAttribute("max") ?? 180);
    setRightjianRotationXBySlider(slider5.value, min, max);
  };
  slider5.addEventListener("input", syncRightjianPitch);
  syncRightjianPitch();
}

const slider6 = sliders[5];
if (slider6) {
  const syncRightbiYaw = () => {
    const min = Number(slider6.getAttribute("min") ?? 0);
    const max = Number(slider6.getAttribute("max") ?? 180);
    setRightbiRotationYBySlider(slider6.value, min, max);
  };
  slider6.addEventListener("input", syncRightbiYaw);
  syncRightbiYaw();
}

const slider7 = sliders[6];
if (slider7) {
  const syncRighthandYaw = () => {
    const min = Number(slider7.getAttribute("min") ?? 0);
    const max = Number(slider7.getAttribute("max") ?? 180);
    setRighthandRotationYBySlider(slider7.value, min, max);
  };
  slider7.addEventListener("input", syncRighthandYaw);
  syncRighthandYaw();
}

setupConnectPopover({ onReloadActions: actionDataApi.reloadFromDataFile });

const motorToggleBtn = document.getElementById("editor-motor-toggle-btn");
if (motorToggleBtn) {
  motorToggleBtn.dataset.motorOpen = "false";
  motorToggleBtn.addEventListener("click", () => {
    const isOpen = motorToggleBtn.dataset.motorOpen === "true";
    motorToggleBtn.dataset.motorOpen = isOpen ? "false" : "true";
    motorToggleBtn.setAttribute(
      "data-i18n",
      isOpen ? "editor_motor_unlock" : "editor_motor_close",
    );
    motorToggleBtn.textContent = isOpen ? "解锁舵机" : "关闭舵机";
  });
}