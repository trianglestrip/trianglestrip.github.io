export const BP_MOBILE = 768;
export const BP_PLAY_STACK = 1024;
export const BP_COMPACT = 640;

export function mobileMediaQuery() {
  return `(min-width: ${BP_MOBILE}px)`;
}

export function playStackMediaQuery() {
  return `(max-width: ${BP_PLAY_STACK}px)`;
}

export function compactMediaQuery() {
  return `(max-width: ${BP_COMPACT}px)`;
}

/** 仅精确指针 + 真实 hover 时启用悬停 UI（手机/触屏 Pad 为 false） */
export function hoverUiMediaQuery() {
  return "(hover: hover) and (pointer: fine)";
}
