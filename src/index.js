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

/**
 * 前端入口：
 * 1) 初始化 UI、主题、语言、3D 预览和关节控制
 * 2) 管理动作列表（本地编辑 + 动作组保存/加载）
 * 3) 将 7 个滑条实时映射到 threePreview 的模型关节
 */
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
const USERID = 4;
const ACTION_DETAIL_BATCH_SIZE = 5;
const DEFAULT_BOOT_GROUP_ID = 14;

/** 将后端可能返回的 JSON 字符串/数组统一转换为数组。 */
function parseMaybeJsonArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

/** 舵机角度标准化：非数字兜底 90，并补齐到固定长度。 */
function normalizeAngles(angles, targetLen = 10) {
  const out = Array.isArray(angles) ? angles.map((n) => Number(n)) : [];
  const normalized = out.map((n) => (Number.isFinite(n) ? n : 90));
  while (normalized.length < targetLen) normalized.push(90);
  return normalized.slice(0, targetLen);
}

/** 从 action 描述里提取动作名，兼容纯文本与 JSON 字符串。 */
function pickActionName(actionId, descriptionText) {
  if (descriptionText && typeof descriptionText === "object") {
    const fromObj = String(descriptionText.action_name ?? "").trim();
    if (fromObj) return fromObj;
  }
  if (typeof descriptionText === "string") {
    const raw = descriptionText.trim();
    if (!raw) return `动作 ${actionId}`;
    try {
      const parsed = JSON.parse(raw);
      const fromJson = String(parsed?.action_name ?? "").trim();
      if (fromJson) return fromJson;
    } catch {
      // 非 JSON 文本时，直接作为动作名兜底
      return raw;
    }
  }
  return `动作 ${actionId}`;
}

/** 按 sequence_orders 排序 action_ids，兼容“actionId 顺序”与“序号顺序”。 */
function orderActionIdsBySequence(actionIds, sequenceOrders) {
  const ids = actionIds.map((id) => Number(id)).filter((id) => Number.isInteger(id));
  if (!Array.isArray(sequenceOrders) || sequenceOrders.length === 0) return ids;
  const seq = sequenceOrders
    .map((item) => Number(item))
    .filter((item) => Number.isInteger(item));
  if (seq.length === 0) return ids;

  // 兼容两种格式：
  // 1) sequence_orders 直接存 action_id 顺序
  // 2) sequence_orders 存 1-based 序号（与 action_ids 同长度）
  const asActionIds = seq.filter((id) => ids.includes(id));
  if (asActionIds.length > 0) {
    const ordered = asActionIds;
    const remaining = ids.filter((id) => !ordered.includes(id));
    return [...ordered, ...remaining];
  }
  const indexPairs = seq
    .map((order, index) => ({ index, order }))
    .filter((x) => x.order >= 1 && x.order <= ids.length)
    .sort((a, b) => a.order - b.order);
  if (indexPairs.length === 0) return ids;
  const orderedByIndex = indexPairs.map((x) => ids[x.index]).filter((id) => Number.isInteger(id));
  const remaining = ids.filter((id) => !orderedByIndex.includes(id));
  return [...orderedByIndex, ...remaining];
}

/** 当后端动作缺失/异常时使用的默认动作参数。 */
function buildDefaultActionDetail(actionId) {
  return {
    action_id: actionId,
    action_name: `默认动作 ${actionId}`,
    duration: 1,
    image_path: "",
    joint_servo_angles: normalizeAngles(null),
  };
}

/** 分批拉取动作详情，避免一次并发过高；失败项回退默认动作。 */
async function fetchActionDetailsInBatches(actionIds) {
  const details = {};
  for (let i = 0; i < actionIds.length; i += ACTION_DETAIL_BATCH_SIZE) {
    const batch = actionIds.slice(i, i + ACTION_DETAIL_BATCH_SIZE);
    const responses = await Promise.all(
      batch.map(async (actionId) => {
        try {
          const res = await getJson(`/actions/${actionId}`);
          if (!res.ok) {
            const msg = res?.data?.message || `获取动作 ${actionId} 失败（HTTP ${res.statusCode}）`;
            console.warn("[action-group] 动作详情缺失，回退默认参数", { actionId, msg });
            return buildDefaultActionDetail(actionId);
          }
          return res.data?.data ?? buildDefaultActionDetail(actionId);
        } catch (err) {
          console.warn("[action-group] 动作详情请求异常，回退默认参数", {
            actionId,
            err: err?.message || err,
          });
          return buildDefaultActionDetail(actionId);
        }
      }),
    );
    responses.forEach((item) => {
      if (!item) return;
      const actionId = Number(item.action_id);
      if (!Number.isInteger(actionId)) return;
      const rawAngles = parseMaybeJsonArray(item.servo_angles);
      const jointServoAngles = normalizeAngles(
        rawAngles.length > 0 ? rawAngles : item.joint_servo_angles,
      );
      details[actionId] = {
        action_id: actionId,
        action_name:
          String(item.action_name ?? "").trim() || pickActionName(actionId, item.description_text),
        duration: Number(item.duration) || 1,
        image_path: String(item.image_path ?? ""),
        joint_servo_angles: jointServoAngles,
      };
    });
  }
  return details;
}

/** 初始化动作数据管理器并挂接到 sub-gallery 渲染。 */
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

/** 「存储动作组」：将当前 actionList 发送到 /api/groups。 */
const actionGroupSaveBtn = document.getElementById("action-group-save-btn");
if (actionGroupSaveBtn) {
  actionGroupSaveBtn.addEventListener("click", async () => {
    const groupNameInput = document.getElementById("editor-action-group-name-input");
    const defaultGroupName = (groupNameInput?.value ?? "").trim() || "未命名动作组";
    const groupInput = window.prompt("请输入 group_name", defaultGroupName);
    if (groupInput == null) return;
    const groupName = groupInput.trim();
    if (!groupName) {
      window.alert("group_name 不能为空");
      return;
    }
    if (!Array.isArray(actionList) || actionList.length === 0) {
      window.alert("当前没有可保存的动作");
      return;
    }

    if (actionList.length === 0) {
      window.alert("动作数据无效，无法保存动作组");
      return;
    }

    actionGroupSaveBtn.disabled = true;
    try {
      // 先创建动作，拿到后端生成的 action_id，再用于创建动作组。
      const createdActionIds = [];
      for (const action of actionList) {
        const actionName = String(action?.action_name ?? "").trim() || "未命名动作";
        const servoAngles = normalizeAngles(action?.joint_angles);
        const createActionPayload = {
          user_id: USERID,
          duration: Number(action?.duration) || 1,
          servo_angles: servoAngles,
          status: true,
          image_path: action?.image_path || null,
          description_text: JSON.stringify({ action_name: actionName }),
        };
        const createActionRes = await postJson("/actions/", createActionPayload);
        if (!createActionRes.ok) {
          const msg =
            createActionRes?.data?.message ||
            `创建动作失败（HTTP ${createActionRes.statusCode}）`;
          throw new Error(msg);
        }
        const createdActionId = Number(createActionRes?.data?.data?.action_id);
        if (!Number.isInteger(createdActionId)) {
          throw new Error("创建动作成功但未返回有效 action_id");
        }
        createdActionIds.push(createdActionId);
      }
      const payload = {
        group_name: groupName,
        user_id: USERID,
        action_ids: createdActionIds,
        sequence_orders: [...createdActionIds],
      };
      const res = await postJson("/groups/", payload);
      if (!res.ok) {
        const msg = res?.data?.message || `保存失败（HTTP ${res.statusCode}）`;
        throw new Error(msg);
      }
      window.alert("动作组保存成功");
      console.log("[action-group] 保存成功", res.data);
    } catch (err) {
      console.error("[action-group] 保存失败", err);
      window.alert(`动作组保存失败：${err.message || "未知错误"}`);
    } finally {
      actionGroupSaveBtn.disabled = false;
    }
  });
}

/** 「加载动作组」：按 groupId 拉组信息 -> 拉动作详情 -> 排序映射 -> 全量替换列表。 */
const actionGroupLoadBtn = document.getElementById("action-group-load-btn");
async function loadActionGroupById(groupId, { showSuccessAlert = true } = {}) {
  const normalizedGroupId = Number(groupId);
  if (!Number.isInteger(normalizedGroupId)) {
    throw new Error("group_id 必须为整数");
  }
  try {
    const groupRes = await getJson(`/groups/${normalizedGroupId}`);
    if (!groupRes.ok) {
      const msg = groupRes?.data?.message || `加载动作组失败（HTTP ${groupRes.statusCode}）`;
      throw new Error(msg);
    }
    const group = groupRes.data?.data;
    if (!group) {
      throw new Error("动作组数据为空");
    }

    const actionIds = parseMaybeJsonArray(group.action_ids)
      .map((id) => Number(id))
      .filter((id) => Number.isInteger(id));
    if (actionIds.length === 0) {
      throw new Error("动作组中没有有效 action_ids");
    }
    const sequenceOrders = parseMaybeJsonArray(group.sequence_orders);
    const orderedActionIds = orderActionIdsBySequence(actionIds, sequenceOrders);
    const actionDetailDict = await fetchActionDetailsInBatches(orderedActionIds);

    const mappedActions = orderedActionIds
      .map((actionId) => actionDetailDict[actionId] ?? buildDefaultActionDetail(actionId))
      .map((item) => ({
        action_id: item.action_id,
        action_name: item.action_name,
        duration: item.duration,
        image_path: item.image_path,
        preview_data_url: "",
        joint_angles: [...item.joint_servo_angles],
        switch_data: 1,
        sync: false,
        type: "motion",
        voice: "",
      }));

    actionDataApi.replaceAllActions(mappedActions);
    const groupNameInput = document.getElementById("editor-action-group-name-input");
    if (groupNameInput) groupNameInput.value = String(group.group_name ?? "");
    if (showSuccessAlert) {
      window.alert(`动作组加载成功，共 ${mappedActions.length} 条动作`);
    }
  } catch (err) {
    throw new Error(err?.message || "未知错误");
  }
}

if (actionGroupLoadBtn) {
  actionGroupLoadBtn.addEventListener("click", async () => {
    const groupInput = window.prompt("请输入 group_id", "");
    if (groupInput == null) return;
    const groupId = Number(groupInput);
    actionGroupLoadBtn.disabled = true;
    try {
      await loadActionGroupById(groupId, { showSuccessAlert: true });
    } catch (err) {
      console.error("[action-group] 加载失败", err);
      window.alert(`动作组加载失败：${err.message || "未知错误"}`);
    } finally {
      actionGroupLoadBtn.disabled = false;
    }
  });
}

// 页面启动后默认加载固定动作组，避免每次手动输入 group_id。
loadActionGroupById(DEFAULT_BOOT_GROUP_ID, { showSuccessAlert: false }).catch((err) => {
  console.error("[action-group] 启动默认加载失败", {
    groupId: DEFAULT_BOOT_GROUP_ID,
    message: err?.message || err,
  });
});

/** 关节滑条与 threePreview 旋转映射（索引与 UI 排列保持一致）。 */
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