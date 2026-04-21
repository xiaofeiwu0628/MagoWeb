/**
 * @file jointControl.js — 左侧关节区：滑条与数字输入联动（含步进按钮），拖动时派发 `input` 供 index 映射到 threePreview。
 *
 * 使用方式：
 * - **声明式**：根节点 `data-joint-control`，内含 `.joint-control__slider` 与 `.joint-control__value-input`
 * - **编程式**：`createJointControl(...)` 返回 DOM 片段，可挂载到任意容器
 */

import { getCurrentLocale, t } from "./i18n.js";

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function nudgeSliderValue(slider, delta) {
  const min = Number(slider.min ?? 0);
  const max = Number(slider.max ?? 180);
  const step = Number(slider.step ?? 1) || 1;
  const current = Number(slider.value ?? min);
  const next = clamp(Math.round(current + delta * step), min, max);
  if (next === current) return;
  slider.value = String(next);
  slider.dispatchEvent(new Event("input", { bubbles: true }));
  slider.dispatchEvent(new Event("change", { bubbles: true }));
}

function ensureSliderNudgeButtons(block, slider) {
  const wrap = block.querySelector(".joint-control__slider-wrap");
  if (!wrap || wrap.querySelector(".joint-control__step-btn")) return;

  const decBtn = document.createElement("button");
  decBtn.type = "button";
  decBtn.className = "joint-control__step-btn joint-control__step-btn--dec";
  decBtn.setAttribute("aria-label", "减少 1");

  const incBtn = document.createElement("button");
  incBtn.type = "button";
  incBtn.className = "joint-control__step-btn joint-control__step-btn--inc";
  incBtn.setAttribute("aria-label", "增加 1");

  wrap.prepend(decBtn);
  wrap.appendChild(incBtn);

  decBtn.addEventListener("click", () => nudgeSliderValue(slider, -1));
  incBtn.addEventListener("click", () => nudgeSliderValue(slider, 1));
}

function parseJointInt(raw, min, max) {
  const s = String(raw).trim();
  if (s === "" || s === "-" || s === "+") return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  const rounded = Math.round(n);
  if (Math.abs(n - rounded) > 1e-9) return null;
  return clamp(rounded, min, max);
}

function wireJointControlBlock(block) {
  const slider = block.querySelector(".joint-control__slider");
  const valueEl =
    block.querySelector(".joint-control__value-input") ?? block.querySelector(".joint-control__value");
  if (!slider || !valueEl) return;
  ensureSliderNudgeButtons(block, slider);

  const min = () => Number(slider.min ?? 0);
  const max = () => Number(slider.max ?? 180);

  const syncFromSlider = () => {
    if (valueEl instanceof HTMLInputElement) {
      valueEl.value = slider.value;
    } else {
      valueEl.textContent = slider.value;
    }
  };

  const applyFromValueField = () => {
    if (!(valueEl instanceof HTMLInputElement)) return;
    const lo = min();
    const hi = max();
    const parsed = parseJointInt(valueEl.value, lo, hi);
    if (parsed === null) {
      valueEl.value = slider.value;
      return;
    }
    slider.value = String(parsed);
    valueEl.value = String(parsed);
    slider.dispatchEvent(new Event("input", { bubbles: true }));
    slider.dispatchEvent(new Event("change", { bubbles: true }));
  };

  slider.addEventListener("input", syncFromSlider);
  slider.addEventListener("change", syncFromSlider);
  syncFromSlider();

  if (valueEl instanceof HTMLInputElement) {
    valueEl.addEventListener("change", applyFromValueField);
    valueEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter") valueEl.blur();
    });
    valueEl.addEventListener("blur", applyFromValueField);
    valueEl.addEventListener("wheel", (e) => e.preventDefault(), { passive: false });
  }
}

export function setupJointControls(root = document) {
  root.querySelectorAll("[data-joint-control]").forEach((el) => wireJointControlBlock(el));
}

/** 动态插入一块带 data-joint-control 的 DOM 后调用，避免重复绑定可先去重或仅用 createJointControl */
export function initJointControl(block) {
  if (block?.hasAttribute?.("data-joint-control")) wireJointControlBlock(block);
}

export function createJointControl({
  label = "xx部位：",
  labelI18nKey,
  ariaI18nKey,
  min = 0,
  max = 180,
  value = 90,
  step = 1,
  ariaLabel = "关节数值",
} = {}) {
  const locale = getCurrentLocale();
  const wrap = document.createElement("div");
  wrap.className = "joint-control";
  wrap.setAttribute("data-joint-control", "");

  const top = document.createElement("div");
  top.className = "joint-control__top";

  const labelEl = document.createElement("span");
  labelEl.className = "joint-control__label";
  if (labelI18nKey) {
    labelEl.setAttribute("data-i18n", labelI18nKey);
    labelEl.textContent = t(labelI18nKey, locale);
  } else {
    labelEl.textContent = label;
  }

  const valueEl = document.createElement("input");
  valueEl.type = "number";
  valueEl.className = "joint-control__value joint-control__value-input";
  valueEl.min = String(min);
  valueEl.max = String(max);
  valueEl.step = String(step);
  valueEl.setAttribute("inputmode", "numeric");
  valueEl.setAttribute("aria-live", "polite");
  valueEl.value = String(clamp(Math.round(Number(value) || 0), min, max));

  top.append(labelEl, valueEl);

  const sliderWrap = document.createElement("div");
  sliderWrap.className = "joint-control__slider-wrap";

  const slider = document.createElement("input");
  slider.type = "range";
  slider.className = "joint-control__slider";
  slider.min = String(min);
  slider.max = String(max);
  slider.value = String(value);
  slider.step = String(step);
  if (ariaI18nKey) {
    slider.setAttribute("data-i18n-aria", ariaI18nKey);
    slider.setAttribute("aria-label", t(ariaI18nKey, locale));
  } else {
    slider.setAttribute("aria-label", ariaLabel);
  }

  sliderWrap.appendChild(slider);
  wrap.append(top, sliderWrap);

  wireJointControlBlock(wrap);
  return wrap;
}
