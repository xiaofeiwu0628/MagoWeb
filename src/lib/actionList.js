/**
 * @file actionList.js
 *
 * 从 `data/actions.js` 导出的 **initialActions**（内置标准演示数据，不访问网络）
 * 深拷贝出可变数组 `actionList`，供画廊、编辑器、模拟执行等模块共享引用。
 *
 * 与持久化的关系：`actionDataManager` 启动时若读到 localStorage 会替换本数组内容；
 * 侧栏「刷新」可调用 `reloadFromDataFile()` 再次用 `initialActions` 覆盖。
 */
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
