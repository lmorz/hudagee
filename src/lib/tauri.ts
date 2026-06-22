import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";

export function isTauriRuntime() {
  return "__TAURI_INTERNALS__" in window;
}

export async function revealMainWindow() {
  if (!isTauriRuntime()) {
    return;
  }

  await invoke("reveal_main_window");
}

export async function isAutostartSession() {
  if (!isTauriRuntime()) {
    return false;
  }

  return invoke<boolean>("is_autostart_session");
}

export async function showMainWindowFromShortcut() {
  if (!isTauriRuntime()) {
    return;
  }

  await invoke("reveal_main_window");
}

export async function hideMainWindow() {
  if (!isTauriRuntime()) {
    return;
  }

  await getCurrentWindow().hide();
}
