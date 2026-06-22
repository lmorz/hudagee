import { disable, enable, isEnabled } from "@tauri-apps/plugin-autostart";
import { isTauriRuntime } from "./tauri";

const STORAGE_KEY = "hudagee.launchAtStartup";

export function readLaunchAtStartupPreference() {
  try {
    return localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function writeLaunchAtStartupPreference(enabled: boolean) {
  localStorage.setItem(STORAGE_KEY, enabled ? "true" : "false");
}

export async function syncLaunchAtStartupFromSystem() {
  if (!isTauriRuntime()) {
    return readLaunchAtStartupPreference();
  }

  const enabled = await isEnabled();
  writeLaunchAtStartupPreference(enabled);
  return enabled;
}

export async function applyLaunchAtStartup(enabled: boolean) {
  if (!isTauriRuntime()) {
    writeLaunchAtStartupPreference(enabled);
    return;
  }

  const currentlyEnabled = await isEnabled();
  if (enabled && !currentlyEnabled) {
    await enable();
  } else if (!enabled && currentlyEnabled) {
    await disable();
  }

  writeLaunchAtStartupPreference(enabled);
}

export async function initLaunchAtStartup() {
  if (!isTauriRuntime()) {
    return;
  }

  const preferred = readLaunchAtStartupPreference();
  const currentlyEnabled = await isEnabled();

  if (preferred === currentlyEnabled) {
    return;
  }

  await applyLaunchAtStartup(preferred);
}
