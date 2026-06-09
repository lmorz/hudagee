import { open, save } from "@tauri-apps/plugin-dialog";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";

function isTauriRuntime() {
  return "__TAURI_INTERNALS__" in window;
}

export async function saveBackupFile(contents: string) {
  if (!isTauriRuntime()) {
    throw new Error("导出 JSON 文件需要在 Tauri 桌面环境中使用。");
  }

  const path = await save({
    title: "导出加密备份",
    defaultPath: "hudagee-backup.hudagee.json",
    filters: [{ name: "HuDaGee 加密备份", extensions: ["json"] }],
  });

  if (!path) {
    return "已取消导出。";
  }

  await writeTextFile(path, contents);
  return "加密备份已导出。";
}

export async function readBackupFile() {
  if (!isTauriRuntime()) {
    throw new Error("导入 JSON 文件需要在 Tauri 桌面环境中使用。");
  }

  const path = await open({
    title: "导入加密备份",
    multiple: false,
    filters: [{ name: "HuDaGee 加密备份", extensions: ["json"] }],
  });

  if (!path || Array.isArray(path)) {
    return null;
  }

  return readTextFile(path);
}
