/**
 * @file actions.js — **标准使用数据（内置演示动作表）**
 *
 * **作用**：在无服务端、无 localStorage、或用户点击连接面板「刷新」恢复默认时，
 * 为界面提供一组可立即编辑、预览、模拟执行的示例动作（名称、时长、关节角、缩略图路径等）。
 * 不发起网络请求；修改本文件即可更换默认列表，保存后由 `actionList.js` 克隆为 `actionList`。
 *
 * **与「标准」的关系**：这里的 `initialActions` 即项目内约定的「标准/种子」数据，
 * 用于统一演示与联调；上线环境可改为中性占位图或空数组（需同步调整 `actionList` 判空逻辑）。
 *
 * 单条字段需与 `actionDataManager`、底部画廊 `gallery.js` 使用的结构一致。
 */
export const initialActions = [
  {
    action_id: 1,
    action_name: "本地示例 1",
    duration: 1.0,
    image_path: "http://106.53.14.250:3000/uploads/actions/1776139059320_b8hva3kw.png",
    preview_data_url: "",
    joint_angles: [90, 90, 90, 90, 90, 90, 90, 90, 90, 90],
    switch_data: 1,
    sync: false,
    type: "motion",
    voice: "",
  },
  {
    action_id: 2,
    action_name: "本地示例 2",
    duration: 1.2,
    image_path: "http://106.53.14.250:3000/uploads/actions/1776139059320_b8hva3kw.png",
    preview_data_url: "",
    joint_angles: [90, 85, 95, 90, 90, 90, 90, 90, 90, 90],
    switch_data: 1,
    sync: false,
    type: "motion",
    voice: "",
  },
  {
    action_id: 3,
    action_name: "本地示例 3",
    duration: 0.9,
    image_path: "http://106.53.14.250:3000/uploads/actions/1776139059320_b8hva3kw.png",
    preview_data_url: "",
    joint_angles: [75, 90, 90, 100, 90, 90, 80, 90, 90, 90],
    switch_data: 1,
    sync: false,
    type: "motion",
    voice: "",
  },
  {
    action_id: 4,
    action_name: "本地示例 4",
    duration: 1.1,
    image_path: "http://106.53.14.250:3000/uploads/actions/1776139059320_b8hva3kw.png",
    preview_data_url: "",
    joint_angles: [90, 100, 80, 90, 90, 95, 90, 85, 90, 90],
    switch_data: 1,
    sync: false,
    type: "motion",
    voice: "",
  },
  {
    action_id: 5,
    action_name: "本地示例 5",
    duration: 1.3,
    image_path: "http://106.53.14.250:3000/uploads/actions/1776139059320_b8hva3kw.png",
    preview_data_url: "",
    joint_angles: [90, 90, 110, 70, 90, 90, 90, 100, 75, 90],
    switch_data: 1,
    sync: false,
    type: "motion",
    voice: "",
  },
  {
    action_id: 6,
    action_name: "本地示例 6",
    duration: 1.0,
    image_path: "http://106.53.14.250:3000/uploads/actions/1776144397678_gxfct2g0.png",
    preview_data_url: "",
    joint_angles: [85, 95, 90, 90, 100, 88, 92, 90, 95, 90],
    switch_data: 1,
    sync: false,
    type: "motion",
    voice: "",
  },
];
