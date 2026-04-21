/**
 * @file uiAssets.js — 在入口最早调用：把 webpack 处理后的 SVG URL 赋给页面内 `<img id="asset-*">`，
 * 并为时间轴节点设置 `background-image`，保证图标与装饰图路径正确。
 */
import assetVector2 from "../../assets/vector2.svg";
import assetGroup2 from "../../assets/group2.svg";
import assetGroup3 from "../../assets/group3.svg";
import assetVector from "../../assets/vector.svg";
import assetGroup1 from "../../assets/group1.svg";
import assetGroup9 from "../../assets/group9.svg";
import assetVector1 from "../../assets/vector1.svg";
import assetVector3 from "../../assets/vector3.svg";
import assetVector15 from "../../assets/vector15.svg";

function setSrc(id, url) {
  const el = document.getElementById(id);
  if (el) el.src = url;
}

export function initUiAssets() {
  setSrc("asset-vector2", assetVector2);
  setSrc("asset-group2", assetGroup2);
  setSrc("asset-group1", assetGroup1);
  setSrc("asset-group9", assetGroup9);
  setSrc("asset-play-icon", assetVector);
  setSrc("asset-save-chevron", assetVector1);
  setSrc("asset-play-timeline", assetVector);
  setSrc("asset-minus", assetVector15);
  setSrc("asset-close", assetVector3);

  // 时间轴分段装饰图（与 Figma 导出一致）
  document.querySelectorAll(".timeline__seg").forEach((node) => {
    node.style.backgroundImage = `url(${assetGroup3})`;
  });
}
