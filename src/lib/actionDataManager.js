import { initialActions } from "./data/actions.js";

function cloneAction(a) {
  return {
    ...a,
    joint_angles: Array.isArray(a.joint_angles) ? [...a.joint_angles] : [],
  };
}

/**
 * 纯本地动作数据：无网络。列表变更后通过 onListChanged 刷新 UI（如底部 sub-gallery）。
 * 卡片预览图由 gallery 读取 `preview_data_url`（优先）与 `image_path`（外链或根路径 URL）展示。
 */
export function setupActionDataManager({ actionList, onListChanged } = {}) {
  if (!Array.isArray(actionList)) {
    throw new TypeError("setupActionDataManager: actionList 必须为数组");
  }

  let nextId = Math.max(0, ...actionList.map((x) => Number(x.action_id) || 0)) + 1;

  const notify = () => {
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
    } else {
      actionList.push({
        action_id,
        action_name,
        duration,
        image_path: "",
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
