import { getCurrentWindow } from "@tauri-apps/api/window";

export function isTauriRuntime() {
  return "__TAURI_INTERNALS__" in window;
}

export function revealMainWindow() {
  if (!isTauriRuntime()) {
    return;
  }

  const window = getCurrentWindow();
  void window.show();
  void window.setFocus();
}
