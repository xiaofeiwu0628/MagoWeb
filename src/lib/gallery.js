import { actionList } from "./actionList.js";

const SUB_GALLERY_ID = "sub-gallery";
const SUB_SLIDER_ID = "sub-gallery-slider";
const DRAG_MIME = "application/x-mago-action-id";

let subGalleryEl = null;
let subSliderEl = null;
let selectedActionId = null;
let removeActionById = () => {};
let allocateId = () => 1;
let upsertFromEditor = () => {};

let lastCardDragEndedAt = 0;
let stripDnDBound = false;

function clearSubGalleryDropMarkers() {
  if (!subGalleryEl) return;
  subGalleryEl
    .querySelectorAll(".sub-card--drop-before, .sub-card--drop-after")
    .forEach((el) => el.classList.remove("sub-card--drop-before", "sub-card--drop-after"));
}

function reorderActionByDrag(draggedId, insertBeforeIndex) {
  const from = actionList.findIndex((a) => a.action_id === draggedId);
  if (from < 0) return;
  const bounded = Math.max(0, Math.min(insertBeforeIndex, actionList.length));
  const [item] = actionList.splice(from, 1);
  let ins = bounded;
  if (from < bounded) ins -= 1;
  ins = Math.max(0, Math.min(ins, actionList.length));
  actionList.splice(ins, 0, item);
  renderSubGallery();
}

function hasDragPayload(types) {
  const list = types ? Array.from(types) : [];
  return list.includes(DRAG_MIME) || list.includes("text/plain");
}

function readDraggedActionId(dt) {
  const raw = dt.getData(DRAG_MIME) || dt.getData("text/plain");
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/** 动作卡片缩略图：优先 data URL，其次 `image_path`（外链或站点根路径）。 */
function getActionCardImageSrc(action) {
  const data = String(action.preview_data_url ?? "").trim();
  if (data) return data;
  const path = String(action.image_path ?? "").trim();
  if (path) return path;
  return "";
}

function readJointAnglesForStorage() {
  const sliders = document.querySelectorAll(
    ".joint-control[data-joint-control] .joint-control__slider",
  );
  const out = [];
  sliders.forEach((s) => out.push(Number(s.value) || 90));
  const targetLen = Math.max(10, out.length);
  while (out.length < targetLen) out.push(90);
  return out.slice(0, targetLen);
}

function syncSliderToScroll() {
  if (!subGalleryEl || !subSliderEl) return;
  const max = subGalleryEl.scrollWidth - subGalleryEl.clientWidth;
  if (max <= 0) {
    subSliderEl.min = "0";
    subSliderEl.max = "0";
    subSliderEl.value = "0";
    subSliderEl.disabled = true;
    subSliderEl.setAttribute("aria-valuetext", "");
    return;
  }
  subSliderEl.disabled = false;
  subSliderEl.min = "0";
  subSliderEl.max = String(Math.ceil(max));
  const v = Math.round(subGalleryEl.scrollLeft);
  const clamped = Math.min(Math.max(0, v), Number(subSliderEl.max));
  subSliderEl.value = String(clamped);
  subSliderEl.setAttribute("aria-valuetext", `${clamped} / ${subSliderEl.max}`);
}

export function mountSubGalleryPanel() {
  const frame = document.getElementById("sub-shell-frame");
  if (!frame) return;
  if (!frame.querySelector(".workspace--sub")) {
    frame.innerHTML = `
      <div class="workspace workspace--sub">
        <div class="sub-gallery" id="${SUB_GALLERY_ID}" role="list" aria-label="动作卡片"></div>
        <div class="sub-gallery__slider-wrap">
          <input type="range" class="sub-gallery__slider" id="${SUB_SLIDER_ID}"
            min="0" max="0" value="0" step="1" aria-label="动作条滚动" aria-valuetext="" />
        </div>
      </div>
    `;
  }
  subGalleryEl = document.getElementById(SUB_GALLERY_ID);
  subSliderEl = document.getElementById(SUB_SLIDER_ID);
}

export function renderSubGallery(list = actionList) {
  if (!subGalleryEl) return;

  subGalleryEl.innerHTML = "";
  list.forEach((action) => {
    const card = document.createElement("div");
    card.className = "sub-card sub-card--draggable";
    card.setAttribute("role", "listitem");
    card.dataset.actionId = String(action.action_id);
    card.draggable = true;
    if (selectedActionId === action.action_id) {
      card.classList.add("sub-card--selected");
    }

    const display = document.createElement("div");
    display.className = "sub-display";
    const imgSrc = getActionCardImageSrc(action);
    if (imgSrc) {
      const img = document.createElement("img");
      img.className = "sub-display__img";
      img.src = imgSrc;
      img.alt = action.action_name || `动作 ${action.action_id}`;
      img.loading = "lazy";
      img.draggable = false;
      img.addEventListener("error", () => {
        img.remove();
        const ph = document.createElement("div");
        ph.className = "sub-display__placeholder sub-display__placeholder--broken";
        ph.textContent = "图片加载失败";
        display.appendChild(ph);
      });
      display.appendChild(img);
    } else {
      const ph = document.createElement("div");
      ph.className = "sub-display__placeholder";
      ph.textContent = "无预览";
      display.appendChild(ph);
    }

    const desc = document.createElement("p");
    desc.className = "sub-display__desc";
    desc.textContent = action.action_name || `动作 ${action.action_id}`;

    card.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData(DRAG_MIME, String(action.action_id));
      e.dataTransfer.setData("text/plain", String(action.action_id));
      e.dataTransfer.effectAllowed = "move";
      try {
        e.dataTransfer.setDragImage(card, e.offsetX, e.offsetY);
      } catch {
        /* ignore */
      }
      card.classList.add("sub-card--dragging");
    });

    card.addEventListener("dragend", () => {
      card.classList.remove("sub-card--dragging");
      lastCardDragEndedAt = Date.now();
      clearSubGalleryDropMarkers();
    });

    card.addEventListener("dragover", (e) => {
      if (!hasDragPayload(e.dataTransfer.types)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      const rect = card.getBoundingClientRect();
      const mid = rect.left + rect.width / 2;
      clearSubGalleryDropMarkers();
      if (e.clientX < mid) card.classList.add("sub-card--drop-before");
      else card.classList.add("sub-card--drop-after");
    });

    card.addEventListener("dragleave", (e) => {
      const next = e.relatedTarget;
      if (!next || !card.contains(next)) {
        card.classList.remove("sub-card--drop-before", "sub-card--drop-after");
      }
    });

    card.addEventListener("drop", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const draggedId = readDraggedActionId(e.dataTransfer);
      if (draggedId == null) return;
      const targetIdx = actionList.findIndex((a) => a.action_id === action.action_id);
      if (targetIdx < 0) return;
      const rect = card.getBoundingClientRect();
      const mid = rect.left + rect.width / 2;
      const insertBefore = e.clientX < mid ? targetIdx : targetIdx + 1;
      clearSubGalleryDropMarkers();
      reorderActionByDrag(draggedId, insertBefore);
    });

    card.addEventListener("click", () => {
      if (Date.now() - lastCardDragEndedAt < 280) return;
      selectedActionId = action.action_id;
      const nameInput = document.getElementById("editor-action-group-name-input");
      const durInput = document.getElementById("editor-action-group-duration-input");
      if (nameInput) nameInput.value = action.action_name ?? "";
      if (durInput) durInput.value = String(action.duration ?? "1.0");
      renderSubGallery();
    });

    card.append(display, desc);
    subGalleryEl.appendChild(card);
  });

  requestAnimationFrame(syncSliderToScroll);
}

export function setupSubGallerySlider() {
  if (!subGalleryEl || !subSliderEl) return;

  const onScroll = () => syncSliderToScroll();
  subGalleryEl.addEventListener("scroll", onScroll, { passive: true });

  subSliderEl.addEventListener("input", () => {
    if (subSliderEl.disabled) return;
    subGalleryEl.scrollLeft = Number(subSliderEl.value) || 0;
  });

  window.addEventListener("resize", syncSliderToScroll);
}

const PAN_THRESHOLD_PX = 12;

/**
 * 动作条超出可视宽度时：按住左键拖动横向滑动；滚轮（含纵向）或触控板横向滑动亦可。
 * 不在 pointerdown 时 capture，避免拦截卡片点击；超过阈值后再 capture。
 */
export function setupSubGalleryPointerPan() {
  if (!subGalleryEl) return;

  let pointerId = null;
  let startX = 0;
  let startScrollLeft = 0;
  let dragEngaged = false;
  let suppressNextClick = false;

  const maxScroll = () => subGalleryEl.scrollWidth - subGalleryEl.clientWidth;

  subGalleryEl.addEventListener(
    "click",
    (e) => {
      if (!suppressNextClick) return;
      suppressNextClick = false;
      e.preventDefault();
      e.stopPropagation();
    },
    true,
  );

  subGalleryEl.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    if (maxScroll() <= 0) return;
    if (e.target.closest(".sub-card")) return;
    pointerId = e.pointerId;
    startX = e.clientX;
    startScrollLeft = subGalleryEl.scrollLeft;
    dragEngaged = false;
    suppressNextClick = false;
  });

  subGalleryEl.addEventListener("pointermove", (e) => {
    if (pointerId == null || e.pointerId !== pointerId) return;
    const dx = e.clientX - startX;
    if (!dragEngaged && Math.abs(dx) < PAN_THRESHOLD_PX) return;
    if (!dragEngaged) {
      dragEngaged = true;
      subGalleryEl.classList.add("sub-gallery--pan-active");
      try {
        subGalleryEl.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    }
    subGalleryEl.scrollLeft = startScrollLeft - dx;
    e.preventDefault();
  });

  const endPan = (e) => {
    if (pointerId == null || e.pointerId !== pointerId) return;
    try {
      subGalleryEl.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    if (dragEngaged) {
      suppressNextClick = true;
    }
    dragEngaged = false;
    pointerId = null;
    subGalleryEl.classList.remove("sub-gallery--pan-active");
  };

  subGalleryEl.addEventListener("pointerup", endPan);
  subGalleryEl.addEventListener("pointercancel", endPan);
  document.addEventListener("pointerup", endPan);
  document.addEventListener("pointercancel", endPan);

  const onWorkspaceWheel = (e) => {
    if (maxScroll() <= 0) return;
    let dx = e.deltaX;
    if (Math.abs(e.deltaY) > Math.abs(dx)) {
      dx = e.deltaY;
    }
    if (dx === 0) return;
    e.preventDefault();
    subGalleryEl.scrollLeft += dx;
  };

  const workspace = subGalleryEl.closest(".workspace--sub");
  (workspace ?? subGalleryEl).addEventListener("wheel", onWorkspaceWheel, {
    passive: false,
    capture: true,
  });
}

/**
 * 卡片拖拽调整 actionList 顺序（HTML5 DnD）。
 */
export function setupSubGalleryDragReorder() {
  if (!subGalleryEl || stripDnDBound) return;
  stripDnDBound = true;

  document.addEventListener("dragend", () => clearSubGalleryDropMarkers());

  subGalleryEl.addEventListener("dragover", (e) => {
    if (e.target.closest(".sub-card")) return;
    if (!hasDragPayload(e.dataTransfer.types)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  });

  subGalleryEl.addEventListener("drop", (e) => {
    if (e.target.closest(".sub-card")) return;
    e.preventDefault();
    const draggedId = readDraggedActionId(e.dataTransfer);
    if (draggedId == null) return;
    clearSubGalleryDropMarkers();
    reorderActionByDrag(draggedId, actionList.length);
  });
}

/**
 * 将 actionDataManager 的写操作接到画廊与「保存动作」按钮。
 */
export function wireGalleryActions(api) {
  removeActionById = typeof api.removeActionById === "function" ? api.removeActionById : () => {};
  allocateId = typeof api.allocateId === "function" ? api.allocateId : () => 1;
  upsertFromEditor = typeof api.upsertFromEditor === "function" ? api.upsertFromEditor : () => {};

  const newBtn = document.getElementById("editor-action-new-btn");
  if (newBtn) {
    newBtn.addEventListener("click", () => {
      selectedActionId = null;
      const nameInput = document.getElementById("editor-action-group-name-input");
      const durInput = document.getElementById("editor-action-group-duration-input");
      if (nameInput) nameInput.value = "";
      if (durInput) durInput.value = "1.0";
      renderSubGallery();
    });
  }

  const saveBtn = document.getElementById("editor-action-click-btn");
  if (saveBtn) {
    saveBtn.addEventListener("click", () => {
      const nameInput = document.getElementById("editor-action-group-name-input");
      const durInput = document.getElementById("editor-action-group-duration-input");
      const name = (nameInput?.value ?? "").trim() || "未命名动作";
      const duration = Number(String(durInput?.value ?? "1").replace(",", "."));
      const joint_angles = readJointAnglesForStorage();
      const editingId = selectedActionId;
      const id = editingId != null ? editingId : allocateId();
      upsertFromEditor({
        action_id: id,
        action_name: name,
        duration: Number.isFinite(duration) ? duration : 1,
        joint_angles,
      });
      // 未选中卡片 = 新建：保存后保持未选中，下次保存再分配新 id。
      // 已选中卡片 = 编辑：保持选中，继续覆盖同一条。
      if (editingId == null) {
        selectedActionId = null;
      }
    });
  }

  const deleteBtn = document.getElementById("editor-action-delete-btn");
  if (deleteBtn) {
    deleteBtn.addEventListener("click", () => {
      if (selectedActionId == null) return;
      const id = selectedActionId;
      if (!removeActionById(id)) return;
      selectedActionId = null;
      const nameInput = document.getElementById("editor-action-group-name-input");
      const durInput = document.getElementById("editor-action-group-duration-input");
      if (nameInput) nameInput.value = "";
      if (durInput) durInput.value = "1.0";
    });
  }
}
