import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import type { AccountEntry } from "../types";

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

export async function copyText(value: string) {
  await writeClipboard(value);
}

export function buildShareText(account: AccountEntry) {
  return [
    `职业：${account.profession}`,
    `角色名：${account.characterName}`,
    `账号：${account.username}`,
    `密码：${account.password}`,
  ].join("\n");
}
