/** 站点主色预设（非平台品牌色） */
export const ACCENT_PRESETS = [
  { id: "lemon", label: "柠檬黄", hex: "#f3d04e" },
  { id: "amber", label: "琥珀", hex: "#ffc107" },
  { id: "orange", label: "橙", hex: "#ff8c42" },
  { id: "coral", label: "珊瑚", hex: "#ff6b6b" },
  { id: "red", label: "红", hex: "#e53935" },
  { id: "pink", label: "粉", hex: "#fe2c55" },
  { id: "rose", label: "玫红", hex: "#f06292" },
  { id: "purple", label: "紫", hex: "#9b59b6" },
  { id: "violet", label: "紫罗兰", hex: "#7e57c2" },
  { id: "indigo", label: "靛蓝", hex: "#5c6bc0" },
  { id: "blue", label: "蓝", hex: "#42a5f5" },
  { id: "cyan", label: "青", hex: "#26c6da" },
  { id: "teal", label: "青绿", hex: "#26a69a" },
  { id: "green", label: "绿", hex: "#66bb6a" },
  { id: "lime", label: "草绿", hex: "#9ccc65" },
  { id: "gold", label: "金", hex: "#d4af37" },
];

export const DEFAULT_ACCENT_ID = "lemon";

export function findAccentPreset(id) {
  return ACCENT_PRESETS.find((item) => item.id === id) ?? ACCENT_PRESETS[0];
}
