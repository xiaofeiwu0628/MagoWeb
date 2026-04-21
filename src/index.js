/**
 * @file index.js
 * MagosMaster 单页应用入口：装配 UI、Three 预览、动作列表与服务端同步逻辑。
 * 详细职责见下方 `init*` 调用处与常量注释。
 */
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

const root = document.getElementById("three-root");
const threePreviewApi = root ? initPreview(root) : null;

/** 写入后端 `RobotActions` / `ActionGroups` 等接口时使用的用户 id，需与库中已有用户一致。 */
const USERID = 4;
/** 拉取动作详情时的并发批次大小，减轻服务端压力。 */
const ACTION_DETAIL_BATCH_SIZE = 5;
/** 本地无持久化动作列表时，启动后自动 `GET /groups/:id` 拉取的默认动作组 id。 */
const DEFAULT_BOOT_GROUP_ID = 14;
/** `actionList` 在 localStorage 中的键；非空则跳过上述默认远程加载。 */
const ACTION_LIST_STORAGE_KEY = "magosmaster-action-list-v1";
/** 「模拟执行」时每个动作按 `duration` 拆成的插值步数 = duration * 该帧率。 */
const SIMULATION_FRAMES_PER_SECOND = 30;

/**
 * 前端入口（bundle 挂载点）：
 * 1) 初始化 UI、主题、语言、3D 预览与关节控制
 * 2) 管理动作列表：本地编辑、持久化、与服务端动作组互相同步
 * 3) 将前 7 个关节滑条实时映射到 threePreview 中对应 mesh 的旋转
 * 4) 音乐/素材面板的列表与上传、模拟执行整条动作序列
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
const musicUploadBtn = document.getElementById("editor-music-upload-btn");
const musicSelectEl = document.getElementById("editor-music-select");
const materialBgMusicSelectEl = document.getElementById("material-bg-music-select");
const materialActionGroupSelectEl = document.getElementById("material-action-group-select");
const materialActionGroupLoadBtn = document.getElementById("material-action-group-load-btn");
const materialActionGroupSaveBtn = document.getElementById("material-action-group-save-btn");
const executeSimulateBtn = document.getElementById("execute-simulate-btn");
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

/** 编辑器区域「请选择音乐」下拉：从服务端拉已上传音乐文件名列表。 */
async function loadMusicListToSelect() {
  if (!musicSelectEl) return;
  const placeholderOption = musicSelectEl.querySelector('option[value=""]');
  try {
    const res = await getJson("/uploads/musics");
    if (!res.ok) {
      const msg = res?.data?.message || `获取音乐列表失败（HTTP ${res.statusCode}）`;
      throw new Error(msg);
    }
    const rows = Array.isArray(res?.data?.data) ? res.data.data : [];
    musicSelectEl.innerHTML = "";
    if (placeholderOption) {
      musicSelectEl.appendChild(placeholderOption);
    }
    rows.forEach((item) => {
      const path = String(item?.path ?? "").trim();
      if (!path) return;
      const filename = String(item?.filename ?? "").trim() || path.split("/").pop() || "music";
      const opt = document.createElement("option");
      opt.value = path;
      opt.textContent = filename;
      musicSelectEl.appendChild(opt);
    });
    console.info("[music] 音乐列表加载完成", { count: rows.length });
  } catch (err) {
    console.warn("[music] 音乐列表加载失败", err);
  }
}

/** 去掉最后一个扩展名，用于音乐下拉展示友好名称。 */
function stripFileExtension(filename) {
  const name = String(filename ?? "").trim();
  if (!name) return "";
  return name.replace(/\.[^.]+$/, "");
}

/** 素材面板「背景音乐」下拉：同上接口，展示名去掉扩展名。 */
async function loadMusicListToMaterialSelect() {
  if (!materialBgMusicSelectEl) return;
  const placeholderOption = materialBgMusicSelectEl.querySelector('option[value=""]');
  try {
    const res = await getJson("/uploads/musics");
    if (!res.ok) {
      const msg = res?.data?.message || `获取音乐列表失败（HTTP ${res.statusCode}）`;
      throw new Error(msg);
    }
    const rows = Array.isArray(res?.data?.data) ? res.data.data : [];
    materialBgMusicSelectEl.innerHTML = "";
    if (placeholderOption) {
      materialBgMusicSelectEl.appendChild(placeholderOption);
    }
    rows.forEach((item) => {
      const path = String(item?.path ?? "").trim();
      if (!path) return;
      const filename = String(item?.filename ?? "").trim() || path.split("/").pop() || "music";
      const opt = document.createElement("option");
      opt.value = path;
      opt.textContent = stripFileExtension(filename) || filename;
      materialBgMusicSelectEl.appendChild(opt);
    });
    console.info("[material] 背景音乐下拉加载完成", { count: rows.length });
  } catch (err) {
    console.warn("[material] 背景音乐下拉加载失败", err);
  }
}

/** 将用户选择的文件读成 `data:...;base64,...`，供 `POST /uploads/music`。 */
function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("文件读取失败"));
    reader.readAsDataURL(file);
  });
}

if (musicUploadBtn) {
  musicUploadBtn.addEventListener("click", async () => {
    const musicFile = musicFileInput?.files?.[0];
    if (!musicFile) {
      window.alert("请先选择音乐文件");
      return;
    }
    musicUploadBtn.disabled = true;
    try {
      const musicDataUrl = await fileToDataUrl(musicFile);
      const uploadRes = await postJson("/uploads/music", {
        music_data_url: musicDataUrl,
      });
      if (!uploadRes.ok) {
        const msg = uploadRes?.data?.message || `上传失败（HTTP ${uploadRes.statusCode}）`;
        throw new Error(msg);
      }
      const musicPath = String(uploadRes?.data?.data?.path || "").trim();
      if (!musicPath) {
        throw new Error("上传成功但未返回音乐路径");
      }
      if (musicSelectEl) {
        const opt = document.createElement("option");
        opt.value = musicPath;
        opt.textContent = musicFile.name;
        musicSelectEl.appendChild(opt);
        musicSelectEl.value = musicPath;
      }
      console.info("[music] 上传成功", { name: musicFile.name, path: musicPath });
      window.alert("音乐上传成功");
    } catch (err) {
      console.error("[music] 上传失败", err);
      window.alert(`音乐上传失败：${err.message || "未知错误"}`);
    } finally {
      musicUploadBtn.disabled = false;
    }
  });
}

loadMusicListToSelect();
loadMusicListToMaterialSelect();

/** 判断 localStorage 中是否已有非空动作列表，用于决定是否做启动时远程默认加载。 */
function hasPersistedActionList() {
  try {
    const raw = window.localStorage.getItem(ACTION_LIST_STORAGE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0;
  } catch {
    return false;
  }
}

/** 素材面板「动作组」下拉：`GET /groups?user_id=USERID`，option 上挂 `data-action-ids` 供加载用。 */
async function loadMaterialActionGroupsToSelect() {
  if (!materialActionGroupSelectEl) return;
  const placeholderOption = materialActionGroupSelectEl.querySelector('option[value=""]');
  try {
    const res = await getJson(`/groups?user_id=${USERID}`);
    if (!res.ok) {
      const msg = res?.data?.message || `获取动作组列表失败（HTTP ${res.statusCode}）`;
      throw new Error(msg);
    }
    const groups = Array.isArray(res?.data?.data) ? res.data.data : [];
    materialActionGroupSelectEl.innerHTML = "";
    if (placeholderOption) {
      materialActionGroupSelectEl.appendChild(placeholderOption);
    }
    groups.forEach((group) => {
      const groupId = Number(group?.group_id);
      if (!Number.isInteger(groupId)) return;
      const groupName = String(group?.group_name ?? "").trim() || `动作组 ${groupId}`;
      const actionIds = parseMaybeJsonArray(group?.action_ids)
        .map((id) => Number(id))
        .filter((id) => Number.isInteger(id));
      const opt = document.createElement("option");
      opt.value = String(groupId);
      opt.textContent = groupName;
      opt.dataset.actionIds = JSON.stringify(actionIds);
      materialActionGroupSelectEl.appendChild(opt);
    });
    console.info("[material] 动作组下拉加载完成", { count: groups.length });
  } catch (err) {
    console.warn("[material] 动作组下拉加载失败", err);
  }
}

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

loadMaterialActionGroupsToSelect();

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

const actionGroupSaveBtn = document.getElementById("action-group-save-btn");
/**
 * 「存储动作组」：依次 `POST /actions/` 创建每条动作，再 `POST /groups/` 绑定 action_ids。
 * @param {HTMLButtonElement} triggerBtn 用于禁用防重复点击的按钮
 */
async function handleSaveActionGroupClick(triggerBtn) {
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

  triggerBtn.disabled = true;
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
    triggerBtn.disabled = false;
  }
}

if (actionGroupSaveBtn) {
  actionGroupSaveBtn.addEventListener("click", async () => {
    await handleSaveActionGroupClick(actionGroupSaveBtn);
  });
}

if (materialActionGroupSaveBtn) {
  materialActionGroupSaveBtn.addEventListener("click", async () => {
    await handleSaveActionGroupClick(materialActionGroupSaveBtn);
  });
}

const actionGroupLoadBtn = document.getElementById("action-group-load-btn");
/**
 * 按 `group_id` 加载动作组：`GET /groups/:id` → 批量 `GET /actions/:id` → 写入内存并刷新画廊。
 * @param {{ showSuccessAlert?: boolean }} opts 启动静默加载时可关成功弹窗
 */
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

/**
 * 素材下拉已带 `action_ids` 时直接拉详情，不请求 `GET /groups/:id`（名称来自 option 文案）。
 */
async function loadActionGroupByActionIds(actionIds, groupName = "", { showSuccessAlert = true } = {}) {
  const normalizedActionIds = (Array.isArray(actionIds) ? actionIds : [])
    .map((id) => Number(id))
    .filter((id) => Number.isInteger(id));
  if (normalizedActionIds.length === 0) {
    throw new Error("当前选项没有有效 action_id");
  }
  const actionDetailDict = await fetchActionDetailsInBatches(normalizedActionIds);
  const mappedActions = normalizedActionIds
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
  if (groupNameInput && groupName) {
    groupNameInput.value = groupName;
  }
  if (showSuccessAlert) {
    window.alert(`动作组加载成功，共 ${mappedActions.length} 条动作`);
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

if (materialActionGroupLoadBtn) {
  materialActionGroupLoadBtn.addEventListener("click", async () => {
    const selectedOption =
      materialActionGroupSelectEl?.options?.[materialActionGroupSelectEl.selectedIndex] || null;
    if (!selectedOption || !selectedOption.value) {
      window.alert("请先选择动作组");
      return;
    }
    materialActionGroupLoadBtn.disabled = true;
    try {
      const selectedActionIds = parseMaybeJsonArray(selectedOption.dataset.actionIds);
      const selectedGroupName = String(selectedOption.textContent ?? "").trim();
      await loadActionGroupByActionIds(selectedActionIds, selectedGroupName, {
        showSuccessAlert: true,
      });
    } catch (err) {
      console.error("[material] 加载动作组失败", err);
      window.alert(`加载动作组失败：${err.message || "未知错误"}`);
    } finally {
      materialActionGroupLoadBtn.disabled = false;
    }
  });
}

// 启动时优先使用本地持久化；仅当本地为空时才请求服务端初始动作组。
if (!hasPersistedActionList()) {
  loadActionGroupById(DEFAULT_BOOT_GROUP_ID, { showSuccessAlert: false }).catch((err) => {
    console.error("[action-group] 启动默认加载失败", {
      groupId: DEFAULT_BOOT_GROUP_ID,
      message: err?.message || err,
    });
  });
} else {
  console.info("[action-group] 检测到本地持久化 actionList，跳过启动 GET 加载");
}

/* ---------- 关节滑条 ↔ 模型：第 1 个为身体 roll，2–7 为左右肩/臂/手（与 HTML 顺序一致） ---------- */
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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 将数值限制在滑条 min/max 内，避免模拟执行写出界。 */
function clampToSliderRange(value, slider) {
  const min = Number(slider.getAttribute("min") ?? 0);
  const max = Number(slider.getAttribute("max") ?? 180);
  return Math.min(max, Math.max(min, value));
}

/** 模拟执行优先读持久化 JSON（与 actionDataManager 同键），保证与画廊展示一致。 */
function readPersistedActionListForSimulation() {
  try {
    const raw = window.localStorage.getItem(ACTION_LIST_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** 单条动作：从前 7 个滑条当前值线性插值到 `action.joint_angles`，每帧派发 `input` 驱动 3D。 */
async function animateActionByDuration(action) {
  const targetSliders = sliders.slice(0, 7).filter(Boolean);
  if (targetSliders.length === 0) return;
  const actionAngles = Array.isArray(action?.joint_angles) ? action.joint_angles : [];
  const startValues = targetSliders.map((slider) => Number(slider.value) || 90);
  const endValues = targetSliders.map((slider, idx) => {
    const raw = Number(actionAngles[idx]);
    const fallback = startValues[idx];
    const normalized = Number.isFinite(raw) ? raw : fallback;
    return clampToSliderRange(normalized, slider);
  });

  const durationSec = Number(action?.duration);
  const safeDurationSec = Number.isFinite(durationSec) && durationSec > 0 ? durationSec : 1;
  const totalFrames = Math.max(1, Math.round(safeDurationSec * SIMULATION_FRAMES_PER_SECOND));
  const frameDelayMs = (safeDurationSec * 1000) / totalFrames;

  for (let frame = 1; frame <= totalFrames; frame += 1) {
    const t = frame / totalFrames;
    targetSliders.forEach((slider, idx) => {
      const value = startValues[idx] + (endValues[idx] - startValues[idx]) * t;
      slider.value = String(Math.round(value));
      slider.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await sleep(frameDelayMs);
  }
}

/** 模拟执行过程中禁用前 7 个关节滑条，避免与动画抢状态。 */
function setSliderInteractionLocked(locked) {
  const targetSliders = sliders.slice(0, 7).filter(Boolean);
  targetSliders.forEach((slider) => {
    slider.disabled = locked;
  });
}

if (executeSimulateBtn) {
  executeSimulateBtn.addEventListener("click", async () => {
    const persisted = readPersistedActionListForSimulation();
    const sourceActions = persisted.length > 0 ? persisted : actionList;
    if (!Array.isArray(sourceActions) || sourceActions.length === 0) {
      window.alert("没有可模拟执行的动作数据");
      return;
    }
    executeSimulateBtn.disabled = true;
    setSliderInteractionLocked(true);
    try {
      for (const action of sourceActions) {
        await animateActionByDuration(action);
      }
    } finally {
      setSliderInteractionLocked(false);
      executeSimulateBtn.disabled = false;
    }
  });
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