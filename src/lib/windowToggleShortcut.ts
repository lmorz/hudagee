import { getCurrentWindow } from "@tauri-apps/api/window";
import { isRegistered, register, unregister } from "@tauri-apps/plugin-global-shortcut";
import { isTauriRuntime } from "./tauri";

export const DEFAULT_WINDOW_TOGGLE_SHORTCUT = "Alt+Backquote";
const STORAGE_KEY = "hudagee.windowToggleShortcut";

const MODIFIER_ORDER = ["Control", "Alt", "Shift", "Super"] as const;
const MODIFIER_CODES = new Set(["ControlLeft", "ControlRight", "AltLeft", "AltRight", "ShiftLeft", "ShiftRight", "MetaLeft", "MetaRight"]);

const DISPLAY_LABELS: Record<string, string> = {
  Control: "Ctrl",
  Alt: "Alt",
  Shift: "Shift",
  Super: "Win",
  Backquote: "`",
  Minus: "-",
  Equal: "=",
  BracketLeft: "[",
  BracketRight: "]",
  Backslash: "\\",
  Semicolon: ";",
  Quote: "'",
  Comma: ",",
  Period: ".",
  Slash: "/",
  Space: "Space",
};

const RESERVED_SHORTCUTS = new Set([
  "Alt+F4",
  "Alt+Space",
  "Control+Alt+Delete",
  "Control+Shift+Escape",
]);

let activeShortcut: string | null = null;

function normalizeShortcut(shortcut: string) {
  const parts = shortcut
    .split("+")
    .map((part) => part.trim())
    .filter(Boolean);
  const modifiers = MODIFIER_ORDER.filter((modifier) => parts.includes(modifier));
  const keys = parts.filter((part) => !MODIFIER_ORDER.includes(part as (typeof MODIFIER_ORDER)[number]));
  if (keys.length !== 1) {
    return null;
  }
  return [...modifiers, keys[0]].join("+");
}

export function readWindowToggleShortcut() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return DEFAULT_WINDOW_TOGGLE_SHORTCUT;
    }
    return normalizeShortcut(stored) ?? DEFAULT_WINDOW_TOGGLE_SHORTCUT;
  } catch {
    return DEFAULT_WINDOW_TOGGLE_SHORTCUT;
  }
}

export function writeWindowToggleShortcut(shortcut: string) {
  localStorage.setItem(STORAGE_KEY, shortcut);
}

export function formatShortcutLabel(shortcut: string) {
  return shortcut
    .split("+")
    .map((part) => DISPLAY_LABELS[part] ?? part.replace(/^Digit/, "").replace(/^Key/, ""))
    .join(" + ");
}

export function validateWindowToggleShortcut(shortcut: string) {
  const normalized = normalizeShortcut(shortcut);
  if (!normalized) {
    return "快捷键需包含至少一个修饰键和一个普通键。";
  }

  const parts = normalized.split("+");
  const hasModifier = parts.some((part) => MODIFIER_ORDER.includes(part as (typeof MODIFIER_ORDER)[number]));
  if (!hasModifier) {
    return "快捷键必须包含 Ctrl、Alt、Shift 或 Win 之一。";
  }

  if (RESERVED_SHORTCUTS.has(normalized)) {
    return "该组合为系统保留快捷键，请换一个。";
  }

  return null;
}

function modifiersFromEvent(event: KeyboardEvent) {
  const modifiers: string[] = [];
  if (event.ctrlKey) {
    modifiers.push("Control");
  }
  if (event.altKey) {
    modifiers.push("Alt");
  }
  if (event.shiftKey) {
    modifiers.push("Shift");
  }
  if (event.metaKey) {
    modifiers.push("Super");
  }
  return MODIFIER_ORDER.filter((modifier) => modifiers.includes(modifier));
}

export function shortcutFromKeyboardEvent(event: KeyboardEvent) {
  if (MODIFIER_CODES.has(event.code)) {
    return null;
  }

  const modifiers = modifiersFromEvent(event);
  if (modifiers.length === 0) {
    return null;
  }

  return normalizeShortcut([...modifiers, event.code].join("+"));
}

export async function toggleMainWindow() {
  if (!isTauriRuntime()) {
    return;
  }

  const window = getCurrentWindow();
  const [visible, minimized] = await Promise.all([window.isVisible(), window.isMinimized()]);
  if (visible && !minimized) {
    await window.hide();
    return;
  }

  await window.show();
  await window.unminimize();
  await window.setFocus();
}

async function unregisterActiveShortcut() {
  if (!activeShortcut) {
    return;
  }

  try {
    if (await isRegistered(activeShortcut)) {
      await unregister(activeShortcut);
    }
  } catch {
    // ignore stale registrations
  }

  activeShortcut = null;
}

export async function applyWindowToggleShortcut(shortcut: string) {
  if (!isTauriRuntime()) {
    return;
  }

  const normalized = normalizeShortcut(shortcut);
  const validationError = normalized ? validateWindowToggleShortcut(normalized) : "快捷键格式无效。";
  if (!normalized || validationError) {
    throw new Error(validationError ?? "快捷键格式无效。");
  }

  await unregisterActiveShortcut();

  try {
    await register(normalized, (event) => {
      if (event.state === "Pressed") {
        void toggleMainWindow();
      }
    });
  } catch {
    throw new Error("快捷键注册失败，可能已被其他程序占用。");
  }

  activeShortcut = normalized;
  writeWindowToggleShortcut(normalized);
}

export async function initWindowToggleShortcut() {
  await applyWindowToggleShortcut(readWindowToggleShortcut());
}

export async function pauseWindowToggleShortcut() {
  await unregisterActiveShortcut();
}

export async function resumeWindowToggleShortcut() {
  await applyWindowToggleShortcut(readWindowToggleShortcut());
}
