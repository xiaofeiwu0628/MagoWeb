/**
 * Local action list manager:
 * - merge persisted list from localStorage at startup
 * - allocate incremental ids
 * - persist and notify on changes
 * - reloadFromDataFile clears list (seed data removed)
 */

const ACTION_LIST_STORAGE_KEY = "magosmaster-action-list-v1";

function cloneAction(a) {
  return {
    ...a,
    joint_angles: Array.isArray(a.joint_angles) ? [...a.joint_angles] : [],
  };
}

function normalizeActionRecord(raw) {
  const actionId = Number(raw?.action_id);
  if (!Number.isInteger(actionId)) return null;
  return {
    action_id: actionId,
    action_name: String(raw?.action_name ?? "").trim() || `Action ${actionId}`,
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

function readPersistedActionList() {
  if (typeof window === "undefined" || !window.localStorage) return [];
  try {
    const raw = window.localStorage.getItem(ACTION_LIST_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeActionRecord).filter(Boolean);
  } catch (err) {
    console.warn("[actionDataManager] read persisted actionList failed", err);
    return [];
  }
}

function persistActionList(actionList) {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    window.localStorage.setItem(ACTION_LIST_STORAGE_KEY, JSON.stringify(actionList));
  } catch (err) {
    console.warn("[actionDataManager] persist actionList failed", err);
  }
}

export function setupActionDataManager({ actionList, onListChanged } = {}) {
  if (!Array.isArray(actionList)) {
    throw new TypeError("setupActionDataManager: actionList must be an array");
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
    actionList.length = 0;
    nextId = 1;
    notify();
  }

  function allocateId() {
    return nextId++;
  }

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
    const existing = actionList.find((a) => a.action_id === action_id);
    if (existing) {
      existing.action_name = action_name;
      existing.duration = duration;
      existing.joint_angles = [...joint_angles];
      if (preview_data_url !== undefined) existing.preview_data_url = preview_data_url;
      if (image_path !== undefined) existing.image_path = image_path;
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

  function replaceAllActions(actions) {
    if (!Array.isArray(actions)) {
      throw new TypeError("replaceAllActions: actions must be an array");
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
