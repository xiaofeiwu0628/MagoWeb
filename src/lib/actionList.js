import { initialActions } from "./data/actions.js";

function cloneAction(a) {
  return {
    ...a,
    joint_angles: Array.isArray(a.joint_angles) ? [...a.joint_angles] : [],
  };
}

/** 可变的本地动作列表（与 initialActions 结构一致） */
export const actionList = initialActions.map(cloneAction);
