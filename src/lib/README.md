# lib 模块分类

按功能将脚本划分为以下分组（通过各分组 `index.js` 统一导出）：

- `ui/`：界面组件与交互外观（`uiAssets`、`tabs`、`themeMode`、`statusPanel`、`connectPopover`）
- `actions/`：动作数据与底部画廊（`actionList`、`actionDataManager`、`gallery`）
- `preview/`：Three 预览与截图导出（`threePreview`）
- `network/`：HTTP API 请求封装（`API`）
- `localization/`：多语言与文案（`i18n`）
- `controls/`：关节控件行为（`jointControl`）

目标：

- 入口文件 `src/index.js` 只按“功能分组”导入，不再按“单文件”分散导入。
- 具体实现文件路径保持不变，避免一次性移动文件带来的破坏性改动。
