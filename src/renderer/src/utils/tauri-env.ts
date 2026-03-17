// Centralized, typed Tauri environment detection helpers

export type MaybeTauriWindow = Window & {
  __TAURI_INTERNALS__?: unknown;
  __TAURI__?: unknown;
};

export const isTauriEnv = (): boolean => {
  if (typeof window === "undefined") return false;
  const w = window as MaybeTauriWindow;
  return "__TAURI_INTERNALS__" in w || "__TAURI__" in w;
};

export const hasTauriRuntime = (win: Window): win is MaybeTauriWindow => {
  const w = win as MaybeTauriWindow;
  return "__TAURI_INTERNALS__" in w || "__TAURI__" in w;
};
