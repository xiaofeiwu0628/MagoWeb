/**
 * i18n.js — 多语言文案表、当前语言读写 localStorage、data-i18n 属性批量更新
 */
const STORAGE_KEY = "magosmaster-i18n-locale";

const messages = {
  en: {
    nav_connect: "Connect",
    nav_assets: "Assets",
    nav_ui: "UI",
    nav_status: "Status",
    nav_save_action_group: "Save",
    nav_load_action_group: "Load",
    editor_action_group_gen: "Action Generation",
    editor_music_mode: "Music Mode",
    editor_voice_ctrl: "Voice Control",
    editor_music_upload_btn: "Upload Music",
    editor_music_play_btn: "Play Music",
    editor_music_select_placeholder: "Select music",
    editor_music_pick_file: "Choose file",
    editor_music_no_file: "No file chosen",
    editor_music_file_input_aria: "Choose music file",
    editor_music_select_aria: "Music select dropdown",
    editor_workspace_content_aria: "Right workspace content",
    editor_voice_input_aria: "Voice or text input",
    editor_voice_actions_aria: "Voice clip actions",
    editor_voice_play: "Play",
    editor_voice_pause: "Add",
    editor_voice_delete: "Delete",
    editor_group_name: "Action Group Name:",
    editor_group_duration: "Action Duration",
    editor_group_duration_input_aria: "Action duration input",
    editor_motor_unlock: "Unlock Servo",
    editor_motor_close: "Close Servo",
    editor_click_btn: "Save Action",
    editor_new_action_btn: "New Action",
    editor_export_preview_btn: "Export preview image",
    editor_delete_action_btn: "Delete Action",
    connect_title: "Connect",
    connect_port: "Port",
    connect_refresh: "Refresh",
    connect_connect: "Connect",
    connect_disconnect: "Disconnect",
    material_title: "Assets",
    material_action_group: "Action",
    material_bg_image: "BG Image",
    material_bg_music: "BG Music",
    material_expression: "Expression",
    select_placeholder: "Pick",
    material_btn_music: "Music",
    material_btn_expression: "Expression",
    material_btn_load: "Load",
    material_btn_save: "Save",
    ui_title: "UI",
    ui_back_blockly: "Back to Blockly",
    ui_style: "Style",
    ui_light: "Light Mode",
    ui_dark: "Dark Mode",
    ui_language: "Language",
    ui_lang_en: "English",
    ui_lang_zh_hans: "简体中文",
    ui_lang_zh_hant: "繁體中文",
    status_panel_title: "Status",
    status_panel_aria: "Status panel",
    status_bt_state_1: "No device connected",
    status_bt_state_2: "Connecting…",
    status_bt_state_3: "Connected",
    status_battery_label: "Battery ",
    execute_dance: "Dance Mode",
    execute_sync: "Sync Motion",
    execute_simulate: "Simulate",
    execute_run: "Run",
    joint_part_1: "Head:",
    joint_part_1_aria: "Head value",
    joint_part_2: "Left shoulder:",
    joint_part_2_aria: "Left shoulder value",
    joint_part_3: "Left arm:",
    joint_part_3_aria: "Left arm value",
    joint_part_4: "Left hand:",
    joint_part_4_aria: "Left hand value",
    joint_part_5: "Right shoulder:",
    joint_part_5_aria: "Right shoulder value",
    joint_part_6: "Right arm:",
    joint_part_6_aria: "Right arm value",
    joint_part_7: "Right hand:",
    joint_part_7_aria: "Right hand value",
    joint_tools_region_aria: "Tool area",
  },
  "zh-Hans": {
    nav_connect: "连接",
    nav_assets: "素材",
    nav_ui: "界面",
    nav_status: "状态",
    nav_save_action_group: "存储动作组",
    nav_load_action_group: "加载动作组",
    editor_action_group_gen: "动作生成",
    editor_music_mode: "音乐模式",
    editor_voice_ctrl: "语音控制",
    editor_music_upload_btn: "上传音乐",
    editor_music_play_btn: "播放音乐",
    editor_music_select_placeholder: "请选择音乐",
    editor_music_pick_file: "选择文件",
    editor_music_no_file: "未选择文件",
    editor_music_file_input_aria: "选择音乐文件",
    editor_music_select_aria: "音乐选择下拉框",
    editor_workspace_content_aria: "右侧工作区内容区",
    editor_voice_input_aria: "语音或文本输入",
    editor_voice_actions_aria: "语音片段操作",
    editor_voice_play: "播放",
    editor_voice_pause: "添加",
    editor_voice_delete: "删除",
    editor_group_name: "动作组的名称：",
    editor_group_duration: "动作使用时长",
    editor_group_duration_input_aria: "动作使用时长输入框",
    editor_motor_unlock: "解锁舵机",
    editor_motor_close: "关闭舵机",
    editor_click_btn: "保存动作",
    editor_new_action_btn: "新建动作",
    editor_export_preview_btn: "导出预览图",
    editor_delete_action_btn: "删除动作",
    connect_title: "连接",
    connect_port: "端口",
    connect_refresh: "刷新",
    connect_connect: "连接",
    connect_disconnect: "断开",
    material_title: "素材",
    material_action_group: "动作组",
    material_bg_image: "背景图片",
    material_bg_music: "背景音乐",
    material_expression: "表情",
    select_placeholder: "请选择",
    material_btn_music: "音乐",
    material_btn_expression: "表情",
    material_btn_load: "加载",
    material_btn_save: "保存",
    ui_title: "界面",
    ui_back_blockly: "转回Blockly界面",
    ui_style: "样式",
    ui_light: "亮色模式",
    ui_dark: "暗色模式",
    ui_language: "语言",
    ui_lang_en: "英语",
    ui_lang_zh_hans: "简体中文",
    ui_lang_zh_hant: "繁體中文",
    status_panel_title: "状态",
    status_panel_aria: "状态提示框",
    status_bt_state_1: "没有设备连接",
    status_bt_state_2: "正在尝试连接中",
    status_bt_state_3: "连接完成",
    status_battery_label: "电量",
    execute_dance: "跳舞模式",
    execute_sync: "同步动作",
    execute_simulate: "模拟执行",
    execute_run: "执行",
    joint_part_1: "头部：",
    joint_part_1_aria: "头部数值",
    joint_part_2: "左肩：",
    joint_part_2_aria: "左肩数值",
    joint_part_3: "左臂：",
    joint_part_3_aria: "左臂数值",
    joint_part_4: "左手：",
    joint_part_4_aria: "左手数值",
    joint_part_5: "右肩：",
    joint_part_5_aria: "右肩数值",
    joint_part_6: "右臂：",
    joint_part_6_aria: "右臂数值",
    joint_part_7: "右手：",
    joint_part_7_aria: "右手数值",
    joint_tools_region_aria: "工具区",
  },
  "zh-Hant": {
    nav_connect: "連接",
    nav_assets: "素材",
    nav_ui: "介面",
    nav_status: "狀態",
    nav_save_action_group: "儲存動作組",
    nav_load_action_group: "載入動作組",
    editor_action_group_gen: "動作生成",
    editor_music_mode: "音樂模式",
    editor_voice_ctrl: "語音控制",
    editor_music_upload_btn: "上傳音樂",
    editor_music_play_btn: "播放音樂",
    editor_music_select_placeholder: "請選擇音樂",
    editor_music_pick_file: "選擇檔案",
    editor_music_no_file: "未選擇檔案",
    editor_music_file_input_aria: "選擇音樂檔案",
    editor_music_select_aria: "音樂選擇下拉框",
    editor_workspace_content_aria: "右側工作區內容區",
    editor_voice_input_aria: "語音或文字輸入",
    editor_voice_actions_aria: "語音片段操作",
    editor_voice_play: "播放",
    editor_voice_pause: "添加",
    editor_voice_delete: "刪除",
    editor_group_name: "動作組的名稱：",
    editor_group_duration: "動作使用時長",
    editor_group_duration_input_aria: "動作使用時長輸入框",
    editor_motor_unlock: "解鎖舵機",
    editor_motor_close: "關閉舵機",
    editor_click_btn: "保存動作",
    editor_new_action_btn: "新增動作",
    editor_export_preview_btn: "匯出預覽圖",
    editor_delete_action_btn: "刪除動作",
    connect_title: "連接",
    connect_port: "埠口",
    connect_refresh: "刷新",
    connect_connect: "連接",
    connect_disconnect: "斷開",
    material_title: "素材",
    material_action_group: "動作組",
    material_bg_image: "背景圖片",
    material_bg_music: "背景音樂",
    material_expression: "表情",
    select_placeholder: "請選擇",
    material_btn_music: "音樂",
    material_btn_expression: "表情",
    material_btn_load: "載入",
    material_btn_save: "保存",
    ui_title: "介面",
    ui_back_blockly: "轉回Blockly介面",
    ui_style: "樣式",
    ui_light: "亮色模式",
    ui_dark: "暗色模式",
    ui_language: "語言",
    ui_lang_en: "英語",
    ui_lang_zh_hans: "簡體中文",
    ui_lang_zh_hant: "繁體中文",
    status_panel_title: "狀態",
    status_panel_aria: "狀態提示框",
    status_bt_state_1: "沒有設備連接",
    status_bt_state_2: "正在嘗試連接中",
    status_bt_state_3: "連接完成",
    status_battery_label: "電量",
    execute_dance: "跳舞模式",
    execute_sync: "同步動作",
    execute_simulate: "模擬執行",
    execute_run: "執行",
    joint_part_1: "頭部：",
    joint_part_1_aria: "頭部數值",
    joint_part_2: "左肩：",
    joint_part_2_aria: "左肩數值",
    joint_part_3: "左臂：",
    joint_part_3_aria: "左臂數值",
    joint_part_4: "左手：",
    joint_part_4_aria: "左手數值",
    joint_part_5: "右肩：",
    joint_part_5_aria: "右肩數值",
    joint_part_6: "右臂：",
    joint_part_6_aria: "右臂數值",
    joint_part_7: "右手：",
    joint_part_7_aria: "右手數值",
    joint_tools_region_aria: "工具區",
  },
};

function normalizeLocale(locale) {
  if (!locale) return "en";
  const v = locale.toLowerCase();
  if (v.startsWith("zh-tw") || v.startsWith("zh-hk") || v.startsWith("zh-mo")) return "zh-Hant";
  if (v.startsWith("zh")) return "zh-Hans";
  if (v.startsWith("en")) return "en";
  return "en";
}

export function getCurrentLocale() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved && messages[saved]) return saved;
  return normalizeLocale(navigator.language || "en");
}

export function t(key, locale = getCurrentLocale()) {
  return messages[locale]?.[key] ?? messages["zh-Hans"][key] ?? key;
}

export function notifyLocaleChanged(locale) {
  document.dispatchEvent(new CustomEvent("magos:locale-changed", { detail: { locale } }));
}

function applyLocale(locale) {
  document.documentElement.lang = locale === "zh-Hant" ? "zh-Hant" : locale === "zh-Hans" ? "zh-CN" : "en";
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    if (key) el.textContent = t(key, locale);
  });

  document.querySelectorAll("[data-i18n-aria]").forEach((el) => {
    const key = el.getAttribute("data-i18n-aria");
    if (key) el.setAttribute("aria-label", t(key, locale));
  });

  const connectBtn = document.getElementById("connect-toggle-btn");
  if (connectBtn) {
    const isConnected = connectBtn.dataset.connected === "true";
    connectBtn.textContent = isConnected ? t("connect_disconnect", locale) : t("connect_connect", locale);
  }

  notifyLocaleChanged(locale);
}

export function setupI18n({ selectId = "ui-language-select" } = {}) {
  const locale = getCurrentLocale();
  const select = document.getElementById(selectId);

  if (select) {
    select.value = locale;
    select.addEventListener("change", () => {
      const next = messages[select.value] ? select.value : "en";
      localStorage.setItem(STORAGE_KEY, next);
      applyLocale(next);
    });
  }

  localStorage.setItem(STORAGE_KEY, locale);
  applyLocale(locale);
}

