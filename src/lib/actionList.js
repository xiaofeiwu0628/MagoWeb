import { initialActions } from "./data/actions.js";

/** 克隆动作对象，避免直接引用初始数据。 */
function cloneAction(a) {
  return {
    ...a,
    // 角度数组按值复制，避免编辑时污染源对象。
    joint_angles: Array.isArray(a.joint_angles) ? [...a.joint_angles] : [],
  };
}

/** 可变的本地动作列表（与 initialActions 结构一致） */
export const actionList = initialActions.map(cloneAction);
