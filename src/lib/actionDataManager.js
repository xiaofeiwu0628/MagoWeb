/**
 * @file actionDataManager.js
 *
 * 动作列表的「单一数据源」封装：启动时合并 localStorage、分配新 id、
 * 增删改后写回存储并回调 `onListChanged` 刷新画廊；`reloadFromDataFile` 用 `data/actions.js` 重置。
 */
import { initialActions } from "./data/actions.js";

const ACTION_LIST_STORAGE_KEY = "magosmaster-action-list-v1";

function cloneAction(a) {
  return {
    ...a,
    joint_angles: Array.isArray(a.joint_angles) ? [...a.joint_angles] : [],
  };
}

/** 将 localStorage 反序列化后的弱类型对象规整为统一动作结构；非法则返回 null。 */
function normalizeActionRecord(raw) {
  const actionId = Number(raw?.action_id);
  if (!Number.isInteger(actionId)) return null;
  return {
    action_id: actionId,
    action_name: String(raw?.action_name ?? "").trim() || `动作 ${actionId}`,
    duration: Number(raw?.duration) || 1,
    image_path: String(raw?.image_path ?? ""),
    preview_data_url: String(raw?.preview_data_url ?? ""),
    joint_angles: Array.isArray(raw?.joint_angles) ? [...raw.joint_angles] : [],
    switch_data: raw?.switch_data ?? 1,
    sync: Boolean(raw?.sync),
    type: String(raw?.type ?? "motion"),
    voice: String(raw?.voice ?? ""),
  };
}

/** 从 localStorage 读取已保存的动作数组；解析失败返回空数组。 */
function readPersistedActionList() {
  if (typeof window === "undefined" || !window.localStorage) return [];
  try {
    const raw = window.localStorage.getItem(ACTION_LIST_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeActionRecord).filter(Boolean);
  } catch (err) {
    console.warn("[actionDataManager] 读取持久化 actionList 失败", err);
    return [];
  }
}

/** 将当前内存中的动作列表序列化写入 localStorage。 */
function persistActionList(actionList) {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    window.localStorage.setItem(ACTION_LIST_STORAGE_KEY, JSON.stringify(actionList));
  } catch (err) {
    console.warn("[actionDataManager] 持久化 actionList 失败", err);
  }
}

/**
 * 纯本地动作数据：无网络。列表变更后通过 onListChanged 刷新 UI（如底部 sub-gallery）。
 * 卡片预览图由 gallery 读取 `preview_data_url`（优先）与 `image_path`（外链或根路径 URL）展示。
 */
export function setupActionDataManager({ actionList, onListChanged } = {}) {
  if (!Array.isArray(actionList)) {
    throw new TypeError("setupActionDataManager: actionList 必须为数组");
  }

  const persistedList = readPersistedActionList();
  if (persistedList.length > 0) {
    actionList.length = 0;
    actionList.push(...persistedList.map(cloneAction));
  }
  let nextId = Math.max(0, ...actionList.map((x) => Number(x.action_id) || 0)) + 1;

  const notify = () => {
    persistActionList(actionList);
    if (typeof onListChanged === "function") onListChanged();
  };

  function reloadFromDataFile() {
    const fresh = initialActions.map(cloneAction);
    actionList.length = 0;
    actionList.push(...fresh);
    nextId = Math.max(0, ...actionList.map((x) => Number(x.action_id) || 0)) + 1;
    notify();
  }

  function allocateId() {
    return nextId++;
  }

  /** 按 id 删除一条动作；成功删除返回 true 并刷新 onListChanged，未找到返回 false。 */
  function removeActionById(id) {
    const n = Number(id);
    const i = actionList.findIndex((a) => a.action_id === n);
    if (i < 0) return false;
    actionList.splice(i, 1);
    notify();
    return true;
  }

  function upsertFromEditor({
    action_id,
    action_name,
    duration,
    joint_angles,
    preview_data_url,
    image_path,
  }) {
    // 已存在则更新；不存在则按统一字段结构新增一条动作。
    const existing = actionList.find((a) => a.action_id === action_id);
    if (existing) {
      existing.action_name = action_name;
      existing.duration = duration;
      existing.joint_angles = [...joint_angles];
      if (preview_data_url !== undefined) {
        existing.preview_data_url = preview_data_url;
      }
      if (image_path !== undefined) {
        existing.image_path = image_path;
      }
    } else {
      actionList.push({
        action_id,
        action_name,
        duration,
        image_path: image_path ?? "",
        preview_data_url: preview_data_url ?? "",
        joint_angles: [...joint_angles],
        switch_data: 1,
        sync: false,
        type: "motion",
        voice: "",
      });
    }
    notify();
  }

  /** 用一组动作完整覆盖当前列表，并触发 UI 刷新。 */
  function replaceAllActions(actions) {
    if (!Array.isArray(actions)) {
      throw new TypeError("replaceAllActions: actions 必须为数组");
    }
    const fresh = actions.map(cloneAction);
    actionList.length = 0;
    actionList.push(...fresh);
    nextId = Math.max(0, ...actionList.map((x) => Number(x.action_id) || 0)) + 1;
    notify();
  }

  return {
    reloadFromDataFile,
    allocateId,
    removeActionById,
    upsertFromEditor,
    replaceAllActions,
  };
}
