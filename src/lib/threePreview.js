/* global __MAGOS_STL_FILES__, __webpack_public_path__ */
/**
 * threePreview.js — Three.js 场景：加载 STL、关节层级、与左侧滑条联动的旋转
 *
 * 画质方案（主画布与离屏截图一致）：
 * - **sRGB**：`renderer.outputColorSpace = SRGBColorSpace`
 * - **ACES**：`renderer.toneMapping = ACESFilmicToneMapping`
 * - **2× 超采样**：离屏 RT 为输出尺寸的 2 倍，再高质量缩小（抗锯齿）
 * - **截图曝光微调**：仅在 `captureToDataURL` 内对 `toneMappingExposure` 乘以 `captureExposure`，截完恢复
 */
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";

/** 与 gallery 保存/导出共用的截图默认参数（2× 超采样 + 曝光微调）。 */
export const PREVIEW_CAPTURE_DEFAULTS = Object.freeze({
  supersample: 1,
  captureExposure: 1.36,
});

const FALLBACK_STL_FILES = [
  "body.stl",
  "Dizuo.stl",
  "Erduo.stl",
  "Head.stl",
  "Hudiejie.stl",
  "Leftbi.stl",
  "Lefthand.stl",
  "Leftjian.stl",
  "Maozi.stl",
  "Rightbi.stl",
  "Righthand.stl",
  "Rightjian.stl",
  "Xianshiqi.stl",
  "Yuanpan.stl",
  "Zuiba.stl",
];

const MODEL_HIERARCHY = [
  ["Head", "Erduo"],
  ["Head", "Zuiba"],
  ["Head", "Maozi"],
  ["Leftjian", "Leftbi"],
  ["Leftbi", "Lefthand"],
  ["Rightjian", "Rightbi"],
  ["Rightbi", "Righthand"],
  ["body", "Head"],
  ["body", "Leftjian"],
  ["body", "Rightjian"],
  ["body", "Dizuo"],
  ["body", "Yuanpan"],
  ["body", "Xianshiqi"],
  ["body", "Hudiejie"],
];

const JOINT_LOCAL_PIVOTS = {
  Leftjian: new THREE.Vector3(0, 0.6, 0),
  Rightjian: new THREE.Vector3(0, 0.6, 0),
};

/** 指定模型配色：未列出的部件默认白色。 */
const MODEL_COLOR_MAP = Object.freeze({
  body: 0xffffff,
  Yuanpan: 0xffffff,
  Zuiba: 0xffffff,
  Xianshiqi: 0x000000,
  Maozi: 0x000000,
  Erduo: 0x000000,
  Dizuo: 0x000000,
  Hudiejie: 0xff0000,
});

/** 方案一：顶部/轮廓补光参数（提升头顶部暗部与轮廓层次）。 */
const RIM_LIGHT_CONFIG = Object.freeze({
  color: 0xf3f6ff,
  intensity: 0.52,
  position: new THREE.Vector3(-2.8, 5.6, -4.4),
});

let bodyMeshRef = null;
let leftjianMeshRef = null;
let leftbiMeshRef = null;
let lefthandMeshRef = null;
let rightjianMeshRef = null;
let rightbiMeshRef = null;
let righthandMeshRef = null;
let pendingBodyRotationZ = 0;
let pendingLeftjianRotationX = 0;
let pendingLeftbiRotationY = 0;
let pendingLefthandRotationY = 0;
let pendingRightjianRotationX = 0;
let pendingRightbiRotationY = 0;
let pendingRighthandRotationY = 0;

function applyBodyRotationZ(value) {
  pendingBodyRotationZ = value;
  if (bodyMeshRef) bodyMeshRef.rotation.z = value;
}

function applyLeftjianRotationX(value) {
  pendingLeftjianRotationX = value;
  if (leftjianMeshRef) leftjianMeshRef.rotation.x = value;
}

function applyLeftbiRotationY(value) {
  pendingLeftbiRotationY = value;
  if (leftbiMeshRef) leftbiMeshRef.rotation.y = value;
}

function applyLefthandRotationY(value) {
  pendingLefthandRotationY = value;
  if (lefthandMeshRef) lefthandMeshRef.rotation.y = value;
}

function applyRightjianRotationX(value) {
  pendingRightjianRotationX = value;
  if (rightjianMeshRef) rightjianMeshRef.rotation.x = value;
}

function applyRightbiRotationY(value) {
  pendingRightbiRotationY = value;
  if (rightbiMeshRef) rightbiMeshRef.rotation.y = value;
}

function applyRighthandRotationY(value) {
  pendingRighthandRotationY = value;
  if (righthandMeshRef) righthandMeshRef.rotation.y = value;
}

function sliderValueToAngle(value, min = 0, max = 100) {
  const n = Number(value);
  const range = Math.max(1, Number(max) - Number(min));
  const t = (n - Number(min)) / range; // 0..1
  return (t - 0.5) * Math.PI * 2; // -PI..PI
}

export function setBodyRotationZBySlider(value, min = 0, max = 100) {
  applyBodyRotationZ(sliderValueToAngle(value, min, max));
}

export function setLeftjianRotationXBySlider(value, min = 0, max = 100) {
  applyLeftjianRotationX(sliderValueToAngle(value, min, max));
}

export function setLeftbiRotationYBySlider(value, min = 0, max = 100) {
  applyLeftbiRotationY(sliderValueToAngle(value, min, max));
}

export function setLefthandRotationYBySlider(value, min = 0, max = 100) {
  applyLefthandRotationY(sliderValueToAngle(value, min, max));
}

export function setRightjianRotationXBySlider(value, min = 0, max = 100) {
  applyRightjianRotationX(sliderValueToAngle(value, min, max));
}

export function setRightbiRotationYBySlider(value, min = 0, max = 100) {
  applyRightbiRotationY(sliderValueToAngle(value, min, max));
}

export function setRighthandRotationYBySlider(value, min = 0, max = 100) {
  applyRighthandRotationY(sliderValueToAngle(value, min, max));
}

/**
 * STL 由 webpack 复制到输出目录 `models/`，不经 JS 解析（避免二进制被当成脚本导致报错）。
 * 文件名列表在构建时由 DefinePlugin 注入。
 */
function getStlAssetUrls() {
  const injectedFiles =
    typeof __MAGOS_STL_FILES__ !== "undefined" &&
    Array.isArray(__MAGOS_STL_FILES__)
      ? __MAGOS_STL_FILES__
      : [];
  const files = injectedFiles.length > 0 ? injectedFiles : FALLBACK_STL_FILES;
  let base =
    typeof __webpack_public_path__ !== "undefined"
      ? __webpack_public_path__
      : "/";
  if (!base || base === "auto") base = "/";
  else if (!base.endsWith("/")) base += "/";
  if (injectedFiles.length === 0) {
    console.warn(
      "[threePreview] __MAGOS_STL_FILES__ 为空，使用 FALLBACK_STL_FILES 尝试加载。",
    );
  }
  return [...files]
    .sort()
    .map((name) => `${base}models/${encodeURIComponent(name)}`);
}

function disposeObject3D(obj) {
  obj.traverse((child) => {
    if (child.geometry) child.geometry.dispose();
    if (child.material) {
      const mats = Array.isArray(child.material)
        ? child.material
        : [child.material];
      mats.forEach((m) => m.dispose?.());
    }
  });
}

function fitStlGroup(group, targetMaxDim = 1.85) {
  group.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(group);
  if (box.isEmpty()) return { box, scale: 1 };
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z, 1e-6);
  const s = targetMaxDim / maxDim;
  group.scale.setScalar(s);
  group.position.set(-center.x * s, -center.y * s, -center.z * s);
  return { box, scale: s };
}

function moveGroupCenterToOrigin(group) {
  group.updateMatrixWorld(true);
  const centeredBox = new THREE.Box3().setFromObject(group);
  if (centeredBox.isEmpty()) return;
  const centered = centeredBox.getCenter(new THREE.Vector3());
  group.position.sub(centered);
}

function getModelKeyFromUrl(url) {
  const filename = decodeURIComponent(url.split("/").pop() || "");
  return filename.replace(/\.stl$/i, "");
}

function reparentKeepWorldTransform(child, newParent) {
  child.updateMatrixWorld(true);
  newParent.updateMatrixWorld(true);

  const childWorldMatrix = child.matrixWorld.clone();
  newParent.add(child);

  const inverseParentWorld = new THREE.Matrix4()
    .copy(newParent.matrixWorld)
    .invert();
  const localMatrix = inverseParentWorld.multiply(childWorldMatrix);
  localMatrix.decompose(child.position, child.quaternion, child.scale);
  child.updateMatrixWorld(true);
}

function createPivotJointNode(node, pivotLocal, jointName) {
  const parent = node.parent;
  if (!parent) return node;

  parent.updateMatrixWorld(true);
  node.updateMatrixWorld(true);
  const worldPivot = node.localToWorld(pivotLocal.clone());
  const joint = new THREE.Object3D();
  joint.name = jointName;
  joint.position.copy(worldPivot);
  parent.attach(joint);
  joint.attach(node);
  return joint;
}

function clampCaptureSize(n, lo, hi) {
  return Math.max(lo, Math.min(hi, Math.round(Number(n) || 0)));
}

/** 将 RT 像素读入离屏 2D canvas（WebGL 原点在左下，canvas 在左上，需纵向翻转）。 */
function renderTargetPixelsToCanvas(renderer, rt, width, height) {
  const buffer = new Uint8Array(width * height * 4);
  renderer.readRenderTargetPixels(rt, 0, 0, width, height, buffer);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("[threePreview] 无法创建 2D canvas 上下文");
  const imageData = ctx.createImageData(width, height);
  const d = imageData.data;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const src = (y * width + x) * 4;
      const dst = ((height - 1 - y) * width + x) * 4;
      d[dst] = buffer[src];
      d[dst + 1] = buffer[src + 1];
      d[dst + 2] = buffer[src + 2];
      d[dst + 3] = buffer[src + 3];
    }
  }
  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

/** 高质量缩小：等效于超采样抗锯齿（先大 RT 再缩到目标像素）。 */
function downscaleCanvasHighQuality(source, targetW, targetH) {
  const out = document.createElement("canvas");
  out.width = targetW;
  out.height = targetH;
  const ctx = out.getContext("2d");
  if (!ctx) throw new Error("[threePreview] 无法创建 2D canvas 上下文");
  ctx.imageSmoothingEnabled = true;
  if ("imageSmoothingQuality" in ctx) {
    ctx.imageSmoothingQuality = "high";
  }
  ctx.drawImage(
    source,
    0,
    0,
    source.width,
    source.height,
    0,
    0,
    targetW,
    targetH,
  );
  return out;
}

/** 超采样倍数：限制边长，避免 RT 过大爆显存。 */
function clampSupersample(requested, outW, outH, maxSide = 4096) {
  let s = Math.max(1, Math.min(3, Math.round(Number(requested) || 1)));
  while (s > 1 && (outW * s > maxSide || outH * s > maxSide)) {
    s -= 1;
  }
  return s;
}

function triggerDownloadFromDataUrl(dataUrl, filename) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename || "magos-preview.png";
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function setPivotMarkersVisible(group, visible) {
  group.traverse((child) => {
    if (child.isMesh && child.name && child.name.includes("pivot_marker")) {
      child.visible = visible;
    }
  });
}

export function initPreview(root) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf3f5fa);

  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  if ("ColorManagement" in THREE && THREE.ColorManagement) {
    THREE.ColorManagement.enabled = true;
  }
  if ("outputColorSpace" in renderer) {
    renderer.outputColorSpace = THREE.SRGBColorSpace;
  }
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.target.set(0, 1, 0);

  const hemi = new THREE.HemisphereLight(0xffffff, 0x444466, 1.1);
  scene.add(hemi);
  const dir = new THREE.DirectionalLight(0xffffff, 0.85);
  dir.position.set(4, 8, 5);
  scene.add(dir);
  // 头后上方轮廓补光：拉开秃瓢顶部边缘，减轻暗部发闷。
  const rimLight = new THREE.DirectionalLight(
    RIM_LIGHT_CONFIG.color,
    RIM_LIGHT_CONFIG.intensity,
  );
  rimLight.position.copy(RIM_LIGHT_CONFIG.position);
  scene.add(rimLight);

  // 坐标轴（X:红, Y:绿, Z:蓝），长度 1 单位。
  const axesHelper = new THREE.AxesHelper(1);
  scene.add(axesHelper);
  // 1 单位长度指示器：在 (1, 0, 0) 放置一个小球。
  const unitMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.03, 16, 12),
    new THREE.MeshBasicMaterial({ color: 0xff3333 }),
  );
  unitMarker.position.set(1, 0, 0);
  scene.add(unitMarker);

  const stlGroup = new THREE.Group();
  scene.add(stlGroup);

  root.appendChild(renderer.domElement);

  const resize = () => {
    const rect = root.getBoundingClientRect();
    const w = Math.round(rect.width);
    const h = Math.round(rect.height);
    if (!w || !h) return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  };

  resize();
  window.addEventListener("resize", resize);
  let ro;
  if ("ResizeObserver" in window) {
    ro = new ResizeObserver(resize);
    ro.observe(root);
  }

  const stlUrls = getStlAssetUrls();
  if (stlUrls.length > 0) {
    const meshByKey = new Map();

    Promise.allSettled(
      stlUrls.map((url) => {
        const loader = new STLLoader();
        return loader.loadAsync(url).then((geometry) => {
          geometry.computeVertexNormals();
          const modelKey = getModelKeyFromUrl(url);
          const colorHex = MODEL_COLOR_MAP[modelKey] ?? 0xffffff;
          const hasColors = geometry.hasAttribute("color");
          const material = hasColors
            ? new THREE.MeshStandardMaterial({
                vertexColors: true,
                roughness: 0.45,
                metalness: 0.12,
                side: THREE.DoubleSide,
              })
            : new THREE.MeshStandardMaterial({
                color: colorHex,
                roughness: 0.45,
                metalness: 0.15,
                side: THREE.DoubleSide,
              });
          if (!hasColors && material.color) {
            material.color.setHex(colorHex);
          }
          material.side = THREE.DoubleSide;
          const mesh = new THREE.Mesh(geometry, material);
          mesh.name = modelKey;
          meshByKey.set(modelKey, mesh);
          stlGroup.add(mesh);
        });
      }),
    ).then((results) => {
      results.forEach((res, i) => {
        if (res.status === "rejected") {
          console.warn("[threePreview] STL 加载失败:", stlUrls[i], res.reason);
        }
      });
      if (stlGroup.children.length === 0) {
        console.warn("[threePreview] 没有成功加载 STL 模型。");
        return;
      }

      MODEL_HIERARCHY.forEach(([parentKey, childKey]) => {
        const parent = meshByKey.get(parentKey);
        const child = meshByKey.get(childKey);
        if (!parent || !child) {
          console.warn(
            "[threePreview] 组装父子级失败，缺少模型:",
            parentKey,
            "->",
            childKey,
          );
          return;
        }
        // 保持世界姿态不变，再挂到父节点，避免重挂载后 pivot/位置漂移。
        reparentKeepWorldTransform(child, parent);
      });

      const leftjianNode = meshByKey.get("Leftjian");
      if (leftjianNode) {
        const leftjianJoint = createPivotJointNode(
          leftjianNode,
          JOINT_LOCAL_PIVOTS.Leftjian.clone(),
          "Leftjian__joint",
        );
        const leftjianPivotMarker = new THREE.Mesh(
          new THREE.SphereGeometry(0.08, 24, 18),
          new THREE.MeshBasicMaterial({
            color: 0x00ff66,
            depthTest: false,
            depthWrite: false,
          }),
        );
        leftjianPivotMarker.name = "Leftjian__pivot_marker";
        leftjianPivotMarker.renderOrder = 9999;
        leftjianPivotMarker.position.set(0, 0, 0);
        leftjianJoint.add(leftjianPivotMarker);
        meshByKey.set("Leftjian", leftjianJoint);
      }
      const rightjianNode = meshByKey.get("Rightjian");
      if (rightjianNode) {
        meshByKey.set(
          "Rightjian",
          createPivotJointNode(
            rightjianNode,
            JOINT_LOCAL_PIVOTS.Rightjian.clone(),
            "Rightjian__joint",
          ),
        );
      }

      bodyMeshRef = meshByKey.get("body") || null;
      leftjianMeshRef = meshByKey.get("Leftjian") || null;
      leftbiMeshRef = meshByKey.get("Leftbi") || null;
      lefthandMeshRef = meshByKey.get("Lefthand") || null;
      rightjianMeshRef = meshByKey.get("Rightjian") || null;
      rightbiMeshRef = meshByKey.get("Rightbi") || null;
      righthandMeshRef = meshByKey.get("Righthand") || null;
      applyBodyRotationZ(pendingBodyRotationZ);
      applyLeftjianRotationX(pendingLeftjianRotationX);
      applyLeftbiRotationY(pendingLeftbiRotationY);
      applyLefthandRotationY(pendingLefthandRotationY);
      applyRightjianRotationX(pendingRightjianRotationX);
      applyRightbiRotationY(pendingRightbiRotationY);
      applyRighthandRotationY(pendingRighthandRotationY);

      const { box, scale } = fitStlGroup(stlGroup);
      const size = box.getSize(new THREE.Vector3()).multiplyScalar(scale);
      const maxDim = Math.max(size.x, size.y, size.z, 0.5);
      stlGroup.rotation.x = -Math.PI / 2;
      moveGroupCenterToOrigin(stlGroup);
      stlGroup.position.set(0, 0, 0);

      // 按模型尺寸自动取景，避免“已加载但镜头看不到”的情况。
      const fov = (camera.fov * Math.PI) / 180;
      const distance = maxDim / (2 * Math.tan(fov / 2)) + maxDim * 0.8;
      camera.near = Math.max(0.01, distance / 200);
      camera.far = Math.max(50, distance * 20);
      camera.updateProjectionMatrix();
      controls.target.set(0, 1, 0);
      camera.position.set(0, 1.25, -2.5);
      controls.minDistance = distance * 0.2;
      controls.maxDistance = distance * 6;
      controls.update();
    });
  } else {
    console.warn("[threePreview] src/assets/models 中未找到 .stl 文件。");
  }

  let raf = 0;
  const tick = () => {
    raf = requestAnimationFrame(tick);
    controls.update();
    // const t = performance.now() * 0.0004;
    // stlGroup.rotation.y = Math.sin(t) * 0.06;
    renderer.render(scene, camera);
  };
  tick();

  let disposed = false;

  /**
   * 使用离屏 WebGLRenderTarget 渲染一帧，得到 Data URL（可写入 `preview_data_url` 或用于下载）。
   * 画质：`supersample` 在内部以更高分辨率渲染再缩小（抗锯齿）；`captureExposure` 仅截图时微调曝光。
   * @param {{
   *   width?: number,
   *   height?: number,
   *   mime?: string,
   *   quality?: number,
   *   includeHelpers?: boolean,
   *   supersample?: number,
   *   captureExposure?: number,
   * }} [options]
   * @returns {string}
   */
  function captureToDataURL(options = {}) {
    if (disposed) {
      throw new Error("[threePreview] 已释放，无法截图");
    }
    const width = clampCaptureSize(options.width ?? 640, 64, 2048);
    const height = clampCaptureSize(options.height ?? 480, 64, 2048);
    const mime = options.mime || "image/png";
    const quality =
      typeof options.quality === "number" ? options.quality : 0.92;
    const includeHelpers = options.includeHelpers === true;
    const supersample = clampSupersample(
      options.supersample ?? PREVIEW_CAPTURE_DEFAULTS.supersample,
      width,
      height,
    );
    const captureExposure =
      typeof options.captureExposure === "number"
        ? options.captureExposure
        : PREVIEW_CAPTURE_DEFAULTS.captureExposure;

    controls.update();

    const prevAspect = camera.aspect;
    const prevTarget = renderer.getRenderTarget();
    const prevToneExposure = renderer.toneMappingExposure;

    const axesVis = axesHelper.visible;
    const markerVis = unitMarker.visible;
    if (!includeHelpers) {
      axesHelper.visible = false;
      unitMarker.visible = false;
      setPivotMarkersVisible(stlGroup, false);
    }

    const rtw = width * supersample;
    const rth = height * supersample;
    camera.aspect = rtw / rth;
    camera.updateProjectionMatrix();

    renderer.toneMappingExposure = prevToneExposure * captureExposure;

    const rt = new THREE.WebGLRenderTarget(rtw, rth, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.UnsignedByteType,
      depthBuffer: true,
    });

    renderer.setRenderTarget(rt);
    renderer.render(scene, camera);
    const hiCanvas = renderTargetPixelsToCanvas(renderer, rt, rtw, rth);
    renderer.setRenderTarget(prevTarget);
    rt.dispose();

    renderer.toneMappingExposure = prevToneExposure;

    camera.aspect = prevAspect;
    camera.updateProjectionMatrix();

    if (!includeHelpers) {
      axesHelper.visible = axesVis;
      unitMarker.visible = markerVis;
      setPivotMarkersVisible(stlGroup, true);
    }

    const outCanvas =
      supersample > 1
        ? downscaleCanvasHighQuality(hiCanvas, width, height)
        : hiCanvas;

    const isJpeg =
      mime === "image/jpeg" ||
      mime === "image/jpg" ||
      mime === "image/pjpeg";
    return outCanvas.toDataURL(mime, isJpeg ? quality : undefined);
  }

  /**
   * 截图并触发浏览器下载到本地。
   * @param {{
   *   width?: number,
   *   height?: number,
   *   mime?: string,
   *   quality?: number,
   *   filename?: string,
   *   includeHelpers?: boolean,
   *   supersample?: number,
   *   captureExposure?: number,
   * }} [options]
   * @returns {string} 与下载文件相同的 Data URL
   */
  function downloadCapture(options = {}) {
    const mime = options.mime || "image/png";
    const ext =
      mime.includes("jpeg") || mime.includes("jpg") ? ".jpg" : ".png";
    const filename =
      options.filename || `magos-preview-${Date.now()}${ext}`;
    const dataUrl = captureToDataURL(options);
    console.log(dataUrl);
    triggerDownloadFromDataUrl(dataUrl, filename);
    return dataUrl;
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    cancelAnimationFrame(raf);
    window.removeEventListener("resize", resize);
    if (ro) ro.disconnect();
    disposeObject3D(stlGroup);
    bodyMeshRef = null;
    leftjianMeshRef = null;
    leftbiMeshRef = null;
    lefthandMeshRef = null;
    rightjianMeshRef = null;
    rightbiMeshRef = null;
    righthandMeshRef = null;
    if (axesHelper.parent) scene.remove(axesHelper);
    if (unitMarker.parent) scene.remove(unitMarker);
    if (rimLight.parent) scene.remove(rimLight);
    unitMarker.geometry?.dispose();
    unitMarker.material?.dispose();
    if (stlGroup.parent) scene.remove(stlGroup);
    controls.dispose();
    renderer.dispose();
    root.removeChild(renderer.domElement);
  }

  return { dispose, captureToDataURL, downloadCapture };
}
