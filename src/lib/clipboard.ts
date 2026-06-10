import { readText, writeText } from "@tauri-apps/plugin-clipboard-manager";
import type { AccountEntry } from "../types";

export type ParsedShareAccount = {
  profession: string;
  characterName: string;
  username: string;
  password: string;
};

const SHARE_FIELD_LABELS: Record<keyof ParsedShareAccount, readonly string[]> = {
  profession: ["职业"],
  characterName: ["名称", "角色名", "角色"],
  username: ["账号"],
  password: ["密码"],
};

function isTauriRuntime() {
  return "__TAURI_INTERNALS__" in window;
}

async function writeClipboard(value: string) {
  if (isTauriRuntime()) {
    await writeText(value);
    return;
  }

  await navigator.clipboard.writeText(value);
}

async function readClipboard() {
  if (isTauriRuntime()) {
    return (await readText()) ?? "";
  }

  return await navigator.clipboard.readText();
}

export async function copyText(value: string) {
  await writeClipboard(value);
}

export async function readClipboardText() {
  return await readClipboard();
}

export function buildShareText(account: AccountEntry) {
  return [
    `职业: ${account.profession}`,
    `名称: ${account.characterName}`,
    `账号: ${account.username}`,
    `密码: ${account.password}`,
  ].join("\n");
}

export function parseShareText(text: string): ParsedShareAccount | null {
  const trimmed = text.trim();
  if (!trimmed) {
    return null;
  }

  const parsed: ParsedShareAccount = {
    profession: "",
    characterName: "",
    username: "",
    password: "",
  };

  for (const line of trimmed.split(/\r?\n/)) {
    const match = line.match(/^([^:：]+)\s*[:：]\s*(.*)$/);
    if (!match) {
      continue;
    }

    const label = match[1].trim();
    const rawValue = match[2];

    for (const [field, labels] of Object.entries(SHARE_FIELD_LABELS) as [keyof ParsedShareAccount, readonly string[]][]) {
      if (labels.includes(label)) {
        parsed[field] = field === "password" ? rawValue : rawValue.trim();
      }
    }
  }

  if (!parsed.characterName || !parsed.username || !parsed.password) {
    return null;
  }

  return parsed;
}
