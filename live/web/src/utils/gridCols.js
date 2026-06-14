/** 与 RoomGrid CSS 断点一致的列数估算 */
export function estimateRoomGridCols(width = typeof window !== "undefined" ? window.innerWidth : 390) {
  if (width >= 1920) return 6;
  if (width >= 1536) return 6;
  if (width >= 1024) return 5;
  if (width >= 768) return 4;
  if (width >= 640) return 3;
  return 2;
}
